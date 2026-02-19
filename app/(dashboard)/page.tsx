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
import {
  Loader2,
  RefreshCw,
  GitCommit,
  CheckCircle,
  Lightbulb,
  AlertCircle,
  FolderGit2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Project {
  id: string;
  name: string;
  description: string | null;
  lastSyncedAt: string | null;
  _count: { commits: number };
}

interface DailyInsights {
  todaysFocus: string;
  recentAchievements: string[];
  suggestedStandup: string;
}

export default function DashboardPage() {
  const [config, setConfig] = useState<unknown>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [insights, setInsights] = useState<DailyInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [configRes, projectsRes] = await Promise.all([
        fetch("/api/azure/config"),
        fetch("/api/projects"),
      ]);
      const configData = await configRes.json();
      const projectsData = await projectsRes.json();
      setConfig(configData);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch {
      // ignore
    } finally {
      setConfigLoading(false);
      setProjectsLoading(false);
    }
  }, []);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/insights");
      if (res.ok) {
        setInsights(await res.json());
      }
    } catch {
      // ignore
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
      const res = await fetch("/api/azure/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(
        `Sync complete! ${data.commitsSynced} commits from ${data.projectsSynced} projects.`
      );
      loadData();
      loadInsights();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sync failed";
      toast.error(message);
    } finally {
      setSyncing(false);
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
    <div className="space-y-8">
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderGit2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projects.length}</p>
                <p className="text-sm text-muted-foreground">Projects</p>
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
                <p className="text-sm text-muted-foreground">Total Commits</p>
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
                <p className="text-sm text-muted-foreground">Synced Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                      <li key={i} className="flex items-start gap-2 text-sm">
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
                    <span className="text-xs text-muted-foreground">
                      {project.lastSyncedAt
                        ? format(
                            new Date(project.lastSyncedAt),
                            "MMM d, h:mm a"
                          )
                        : "Never synced"}
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
              <Button variant="outline" onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync Projects"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
