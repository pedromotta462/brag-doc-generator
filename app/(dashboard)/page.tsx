"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  RefreshCw,
  GitCommit,
  CheckCircle,
  Lightbulb,
  AlertCircle,
  FolderGit2,
  ArrowRight,
  GitBranch,
  CalendarDays,
  BarChart3,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api-client";
import { useErrorModal } from "@/components/error-modal";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Project {
  id: string;
  name: string;
  description: string | null;
  lastSyncedAt: string | null;
  lastCommitDate: string | null;
  _count: { commits: number };
}

interface DailyInsights {
  todaysFocus: string;
  recentAchievements: string[];
  suggestedStandup: string;
}

interface StatsData {
  activityData: { date: string; commits: number }[];
  commitsPerRepo: { name: string; commits: number }[];
  commitsPerProject: { name: string; commits: number }[];
  commitsByDayOfWeek: { name: string; commits: number }[];
  repositories: {
    name: string;
    project: string;
    commits: number;
    lastCommitDate: string;
    recentMessages: string[];
    workSummary: string;
  }[];
  totalCommits: number;
  totalRepos: number;
  hasAiSummaries: boolean;
}

const CHART_COLORS = [
  "#6366f1",
  "#22d3ee",
  "#34d399",
  "#f472b6",
  "#fb923c",
  "#a78bfa",
  "#facc15",
  "#f87171",
];

const PRIMARY_COLOR = "#818cf8";
const PRIMARY_GRADIENT_START = "#818cf8";
const PRIMARY_GRADIENT_END = "#818cf800";
const GRID_COLOR = "rgba(255,255,255,0.08)";
const AXIS_COLOR = "rgba(255,255,255,0.5)";
const TOOLTIP_BG = "#1e1e2e";
const TOOLTIP_BORDER = "rgba(255,255,255,0.1)";

export default function DashboardPage() {
  const { showApiError } = useErrorModal();
  const [config, setConfig] = useState<unknown>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [insights, setInsights] = useState<DailyInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [generatingSummaries, setGeneratingSummaries] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [configData, projectsData, statsData] = await Promise.all([
        apiFetch("/api/azure/config"),
        apiFetch<Project[]>("/api/projects"),
        apiFetch<StatsData>("/api/stats"),
      ]);
      setConfig(configData);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setStats(statsData);
    } catch (err) {
      showApiError(err, "Failed to load dashboard data");
    } finally {
      setConfigLoading(false);
      setProjectsLoading(false);
      setStatsLoading(false);
    }
  }, [showApiError]);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const week = await apiFetch<{
        weekDays: { date: string; hasCommits: boolean }[];
      }>("/api/insights");

      const today = new Date().toISOString().split("T")[0];
      const daysWithCommits = week.weekDays.filter(
        (d) => d.hasCommits && d.date <= today
      );
      const latestDay = daysWithCommits[daysWithCommits.length - 1];

      if (latestDay) {
        const data = await apiFetch<DailyInsights>(
          `/api/insights?date=${latestDay.date}`
        );
        setInsights(data);
      }
    } catch {
      // Insights errors are non-critical on dashboard
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (config) {
      loadInsights();
    }
  }, [config, loadInsights]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await apiFetch<{
        commitsSynced: number;
        projectsSynced: number;
      }>("/api/azure/sync", { method: "POST" });
      toast.success(
        `Sync complete! ${data.commitsSynced} commits from ${data.projectsSynced} projects.`
      );
      loadData();
    } catch (err) {
      showApiError(err, "Failed to sync with Azure DevOps");
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateSummaries = async () => {
    setGeneratingSummaries(true);
    try {
      const aiSummaries = await apiFetch<Record<string, string>>(
        "/api/stats/summaries",
        { method: "POST" }
      );
      if (stats) {
        const updated = { ...stats, hasAiSummaries: true };
        updated.repositories = updated.repositories.map((repo) => ({
          ...repo,
          workSummary: aiSummaries[repo.name] || repo.workSummary,
        }));
        setStats(updated);
      }
      toast.success("AI summaries generated successfully!");
    } catch (err) {
      showApiError(err, "Failed to generate AI summaries");
    } finally {
      setGeneratingSummaries(false);
    }
  };

  if (configLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Connect to Azure DevOps</h2>
          <p className="text-muted-foreground max-w-md">
            To start tracking your work and generating brag docs, configure your
            Azure DevOps connection in Settings.
          </p>
        </div>
        <Link href="/settings">
          <Button size="lg" className="gap-2">
            Configure Connection
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    );
  }

  const totalCommits = projects.reduce((acc, p) => acc + p._count.commits, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your activity and daily insights.
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing}
          className="shadow-lg shadow-primary/20 gap-2"
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {syncing ? "Syncing..." : "Sync Now"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderGit2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projects.length}</p>
                <p className="text-xs text-muted-foreground">Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <GitBranch className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.totalRepos ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">Repositories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <GitCommit className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCommits}</p>
                <p className="text-xs text-muted-foreground">Total Commits</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {projects.filter((p) => p.lastSyncedAt).length}
                </p>
                <p className="text-xs text-muted-foreground">Synced</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="repositories" className="gap-1.5">
            <GitBranch className="w-4 h-4" />
            Repositories
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Daily Insights */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Lightbulb className="w-5 h-5" />
                Daily Standup Assistant
              </CardTitle>
              <CardDescription>
                AI-generated suggestions for your daily standup based on recent
                activity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insightsLoading ? (
                <div className="h-24 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : insights ? (
                <div className="space-y-4">
                  <div className="bg-background/50 p-4 rounded-lg border border-border/50">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Suggested Update
                    </h4>
                    <p className="font-medium text-lg leading-relaxed">
                      {insights.suggestedStandup}
                    </p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-background/30 p-4 rounded-lg">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Recent Achievements
                      </h4>
                      <ul className="space-y-2">
                        {insights.recentAchievements.map((item, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm"
                          >
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-background/30 p-4 rounded-lg">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Today{"'"}s Focus
                      </h4>
                      <p className="text-sm">{insights.todaysFocus}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No insights available yet. Try syncing your data first.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Charts */}
          {statsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : stats ? (
            <>
              {/* Activity Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Commit Activity (Last 30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.activityData}>
                        <defs>
                          <linearGradient
                            id="colorCommits"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={PRIMARY_GRADIENT_START}
                              stopOpacity={0.4}
                            />
                            <stop
                              offset="95%"
                              stopColor={PRIMARY_GRADIENT_END}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={GRID_COLOR}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: AXIS_COLOR }}
                          tickFormatter={(v) => {
                            const d = new Date(v);
                            return `${d.getDate()}/${d.getMonth() + 1}`;
                          }}
                          interval="preserveStartEnd"
                          stroke={GRID_COLOR}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: AXIS_COLOR }}
                          allowDecimals={false}
                          stroke={GRID_COLOR}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: TOOLTIP_BG,
                            border: `1px solid ${TOOLTIP_BORDER}`,
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#e2e8f0",
                          }}
                          labelFormatter={(v) =>
                            format(new Date(v), "MMM d, yyyy")
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="commits"
                          stroke={PRIMARY_COLOR}
                          strokeWidth={2}
                          fill="url(#colorCommits)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Day of Week */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      Commit Distribution by Day of Week
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.commitsByDayOfWeek}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={GRID_COLOR}
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12, fill: AXIS_COLOR }}
                            stroke={GRID_COLOR}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: AXIS_COLOR }}
                            allowDecimals={false}
                            stroke={GRID_COLOR}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: TOOLTIP_BG,
                              border: `1px solid ${TOOLTIP_BORDER}`,
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: "#e2e8f0",
                            }}
                            cursor={{ fill: "rgba(255,255,255,0.04)" }}
                          />
                          <Bar
                            dataKey="commits"
                            fill="#22d3ee"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Commits per Project (Pie) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FolderGit2 className="w-4 h-4 text-primary" />
                      Commits by Project
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-56 flex items-center">
                      <ResponsiveContainer width="50%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.commitsPerProject}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            dataKey="commits"
                            nameKey="name"
                            strokeWidth={2}
                            stroke="#111827"
                          >
                            {stats.commitsPerProject.map((_, i) => (
                              <Cell
                                key={i}
                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: TOOLTIP_BG,
                              border: `1px solid ${TOOLTIP_BORDER}`,
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: "#e2e8f0",
                            }}
                            itemStyle={{ color: "#e2e8f0" }}
                            labelStyle={{ color: "#94a3b8" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2 text-sm">
                        {stats.commitsPerProject.map((p, i) => (
                          <div
                            key={p.name}
                            className="flex items-center gap-2"
                          >
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  CHART_COLORS[i % CHART_COLORS.length],
                              }}
                            />
                            <span className="truncate flex-1 text-muted-foreground">
                              {p.name}
                            </span>
                            <span className="font-semibold tabular-nums" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>
                              {p.commits}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Repos Bar */}
              {stats.commitsPerRepo.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GitBranch className="w-4 h-4 text-primary" />
                      Top Repositories by Commits
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="h-64"
                      style={{
                        minHeight: Math.max(
                          256,
                          stats.commitsPerRepo.slice(0, 10).length * 36
                        ),
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={stats.commitsPerRepo.slice(0, 10)}
                          layout="vertical"
                          margin={{ left: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={GRID_COLOR}
                          />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: AXIS_COLOR }}
                            allowDecimals={false}
                            stroke={GRID_COLOR}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 11, fill: AXIS_COLOR }}
                            width={180}
                            stroke={GRID_COLOR}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: TOOLTIP_BG,
                              border: `1px solid ${TOOLTIP_BORDER}`,
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: "#e2e8f0",
                            }}
                            cursor={{ fill: "rgba(255,255,255,0.04)" }}
                          />
                          <Bar
                            dataKey="commits"
                            fill="#34d399"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}

          {/* Projects List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-primary" />
                Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : projects.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card transition-colors"
                    >
                      <h3
                        className="font-semibold text-lg mb-1 truncate"
                        title={project.name}
                      >
                        {project.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2 min-h-[2.5em]">
                        {project.description || "No description provided"}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          <GitCommit className="w-3 h-3 mr-1" />
                          {project._count.commits} commits
                        </Badge>
                        <span
                          className="text-xs text-muted-foreground"
                          title={
                            project.lastSyncedAt
                              ? `Synced: ${format(new Date(project.lastSyncedAt), "MMM d, h:mm a")}`
                              : ""
                          }
                        >
                          {project.lastCommitDate
                            ? format(
                                new Date(project.lastCommitDate),
                                "MMM d, yyyy"
                              )
                            : "No commits"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    No projects synced yet.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleSync}
                    disabled={syncing}
                  >
                    {syncing ? "Syncing..." : "Sync Projects"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPOSITORIES TAB */}
        <TabsContent value="repositories" className="space-y-4 mt-4">
          {statsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : stats && stats.repositories.length > 0 ? (
            <div className="space-y-4">
              {/* Generate / Refresh AI summaries button */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {stats.hasAiSummaries
                    ? "Summaries generated by AI based on your commit messages."
                    : "Click the button to generate AI-powered work summaries for each repository."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0"
                  disabled={generatingSummaries}
                  onClick={handleGenerateSummaries}
                >
                  {generatingSummaries ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {generatingSummaries
                    ? "Analyzing commits..."
                    : stats.hasAiSummaries
                      ? "Refresh AI Summaries"
                      : "Generate AI Summaries"}
                </Button>
              </div>

              {generatingSummaries && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="py-6 flex items-center gap-4">
                    <div className="relative">
                      <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        AI is analyzing your commits...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Reading commit messages and generating meaningful
                        summaries of your work in each repository. This may take
                        a moment.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {stats.repositories.map((repo) => (
                <Card
                  key={repo.name}
                  className="hover:border-primary/30 transition-colors"
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <GitBranch className="w-4 h-4 text-primary shrink-0" />
                          <h3 className="font-semibold text-base truncate">
                            {repo.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                          <span className="flex items-center gap-1">
                            <FolderGit2 className="w-3 h-3" />
                            {repo.project}
                          </span>
                          <Badge variant="secondary" className="text-xs h-5">
                            {repo.commits} commits
                          </Badge>
                          <span>
                            Last:{" "}
                            {format(
                              new Date(repo.lastCommitDate),
                              "MMM d, yyyy"
                            )}
                          </span>
                        </div>

                        {/* Work summary */}
                        <div className="mb-3 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            {stats.hasAiSummaries && (
                              <Sparkles className="w-3 h-3 text-primary" />
                            )}
                            Work summary
                          </p>
                          <p className="text-sm text-foreground leading-relaxed">
                            {repo.workSummary}
                          </p>
                        </div>

                        {/* Recent commits */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Recent commits
                          </p>
                          {repo.recentMessages.map((msg, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-sm"
                            >
                              <GitCommit className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground line-clamp-1">
                                {msg}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-xl bg-primary/5 border border-primary/10">
                        <span className="text-2xl font-bold text-primary">
                          {repo.commits}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          commits
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <GitBranch className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No Repositories Found
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Sync your Azure DevOps data to see your repositories and
                  commit history.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
