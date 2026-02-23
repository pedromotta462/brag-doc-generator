// ============================================
// Azure DevOps API Service
// ============================================

const API_VERSION = "7.0";

interface AzureProject {
  id: string;
  name: string;
  description?: string;
}

interface AzureRepo {
  id: string;
  name: string;
}

interface AzureCommitAuthor {
  name: string;
  email: string;
  date: string;
}

interface AzureCommit {
  commitId: string;
  comment: string;
  author: AzureCommitAuthor;
  remoteUrl?: string;
}

interface AzureListResponse<T> {
  value: T[];
  count: number;
}

// Build Basic Auth header from PAT
function buildAuthHeader(pat: string): string {
  const encoded = Buffer.from(`:${pat}`).toString("base64");
  return `Basic ${encoded}`;
}

// Generic fetch with error handling
async function fetchAzure<T>(url: string, pat: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: buildAuthHeader(pat),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Azure DevOps API Error: ${response.status} ${response.statusText} - ${text}`
    );
  }

  return response.json() as Promise<T>;
}

// ============================================
// Public API
// ============================================

export async function fetchProjects(
  organization: string,
  pat: string
): Promise<AzureProject[]> {
  const url = `https://dev.azure.com/${encodeURIComponent(organization)}/_apis/projects?api-version=${API_VERSION}&$top=200`;
  const data = await fetchAzure<AzureListResponse<AzureProject>>(url, pat);
  return data.value;
}

export async function fetchRepositories(
  organization: string,
  projectName: string,
  pat: string
): Promise<AzureRepo[]> {
  const url = `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(projectName)}/_apis/git/repositories?api-version=${API_VERSION}`;
  const data = await fetchAzure<AzureListResponse<AzureRepo>>(url, pat);
  return data.value;
}

export async function fetchCommitsForRepo(
  organization: string,
  projectName: string,
  repoId: string,
  pat: string,
  options?: {
    top?: number;
    skip?: number;
    fromDate?: string; // ISO date
    toDate?: string; // ISO date
  }
): Promise<AzureCommit[]> {
  const top = options?.top ?? 500;
  let url = `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(projectName)}/_apis/git/repositories/${repoId}/commits?api-version=${API_VERSION}&searchCriteria.$top=${top}`;

  if (options?.skip) {
    url += `&searchCriteria.$skip=${options.skip}`;
  }
  if (options?.fromDate) {
    url += `&searchCriteria.fromDate=${encodeURIComponent(options.fromDate)}`;
  }
  if (options?.toDate) {
    url += `&searchCriteria.toDate=${encodeURIComponent(options.toDate)}`;
  }

  const data = await fetchAzure<AzureListResponse<AzureCommit>>(url, pat);
  return data.value;
}

// ============================================
// Commit Changes (file-level diff)
// ============================================

interface AzureCommitChange {
  item: {
    objectId: string;
    originalObjectId?: string;
    gitObjectType: string;
    commitId: string;
    path: string;
    url: string;
  };
  changeType:
    | "add"
    | "edit"
    | "delete"
    | "rename"
    | "sourceRename"
    | "targetRename"
    | "all";
}

interface AzureCommitChangesResponse {
  changeCounts: Record<string, number>;
  changes: AzureCommitChange[];
}

export interface CommitFileChange {
  path: string;
  changeType: string;
}

export async function fetchCommitChanges(
  organization: string,
  projectName: string,
  repoId: string,
  commitId: string,
  pat: string
): Promise<CommitFileChange[]> {
  const url = `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(projectName)}/_apis/git/repositories/${repoId}/commits/${commitId}/changes?api-version=${API_VERSION}`;
  const data = await fetchAzure<AzureCommitChangesResponse>(url, pat);
  return data.changes
    .filter((c) => c.item.gitObjectType === "blob")
    .map((c) => ({
      path: c.item.path,
      changeType: c.changeType,
    }));
}

// ============================================
// Multi-Username Commit Filtering
// ============================================

/**
 * Checks if a commit belongs to the user by comparing against
 * multiple aliases (case-insensitive). Compares both author name
 * and author email against all aliases.
 */
export function isCommitByUser(
  commit: AzureCommit,
  userAliases: string[]
): boolean {
  if (userAliases.length === 0) return true; // No filter = all commits

  const normalizedAliases = userAliases.map((alias) => alias.toLowerCase().trim());

  const authorName = (commit.author.name || "").toLowerCase().trim();
  const authorEmail = (commit.author.email || "").toLowerCase().trim();

  return normalizedAliases.some(
    (alias) =>
      authorName === alias ||
      authorEmail === alias ||
      authorName.includes(alias) ||
      authorEmail.includes(alias)
  );
}

/**
 * Full sync: fetch all projects -> repos -> commits, filter by user aliases.
 * Returns structured data ready to be persisted.
 */
export async function syncAllCommits(
  organization: string,
  pat: string,
  userAliases: string[]
) {
  const projects = await fetchProjects(organization, pat);

  const results: {
    project: AzureProject;
    commits: {
      hash: string;
      message: string;
      authorName: string;
      authorEmail: string;
      date: string;
      url?: string;
      repoName: string;
    }[];
  }[] = [];

  for (const project of projects) {
    let projectCommits: typeof results[0]["commits"] = [];

    try {
      const repos = await fetchRepositories(organization, project.name, pat);

      for (const repo of repos) {
        try {
          const commits = await fetchCommitsForRepo(
            organization,
            project.name,
            repo.id,
            pat
          );

          const userCommits = commits
            .filter((c) => isCommitByUser(c, userAliases))
            .map((c) => ({
              hash: c.commitId,
              message: c.comment,
              authorName: c.author.name,
              authorEmail: c.author.email,
              date: c.author.date,
              url: c.remoteUrl,
              repoName: repo.name,
            }));

          projectCommits = [...projectCommits, ...userCommits];
        } catch (err) {
          // Some repos might be empty or inaccessible, skip them
          console.warn(
            `Failed to fetch commits for repo ${repo.name} in ${project.name}:`,
            err
          );
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch repos for project ${project.name}:`, err);
    }

    if (projectCommits.length > 0) {
      results.push({ project, commits: projectCommits });
    }
  }

  return results;
}
