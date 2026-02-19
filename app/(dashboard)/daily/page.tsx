"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  RefreshCw,
  CheckCircle,
  Lightbulb,
  Target,
  MessageSquare,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

interface DailyInsights {
  todaysFocus: string;
  recentAchievements: string[];
  suggestedStandup: string;
}

export default function DailyInsightsPage() {
  const [insights, setInsights] = useState<DailyInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadInsights = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const res = await fetch("/api/insights");
      if (res.ok) {
        const data = await res.json();
        setInsights(data);
        if (showRefresh) toast.success("Insights refreshed!");
      }
    } catch {
      toast.error("Failed to load insights");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const copyStandup = () => {
    if (insights?.suggestedStandup) {
      navigator.clipboard.writeText(insights.suggestedStandup);
      toast.success("Standup text copied to clipboard!");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Daily Insights</h1>
          <p className="text-muted-foreground">
            AI-powered suggestions for your daily standup meeting.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadInsights(true)}
          disabled={isRefreshing}
          className="gap-2"
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh
        </Button>
      </div>

      {insights ? (
        <div className="space-y-6">
          {/* Suggested Standup */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <MessageSquare className="w-5 h-5" />
                Suggested Standup
              </CardTitle>
              <CardDescription>
                Copy and paste this into your daily standup or adjust as needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-background/50 p-5 rounded-lg border border-border/50 relative group">
                <p className="font-medium text-lg leading-relaxed pr-10">
                  {insights.suggestedStandup}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={copyStandup}
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Achievements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                What I Did (Recent Achievements)
              </CardTitle>
              <CardDescription>
                Based on your commits from the last 3 days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.recentAchievements.length > 0 ? (
                <ul className="space-y-3">
                  {insights.recentAchievements.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-sm leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No recent achievements found. Sync your commits first.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Today's Focus */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Today{"'"}s Focus
              </CardTitle>
              <CardDescription>
                AI suggestion for what to focus on today based on your recent
                work patterns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
                  <p className="text-sm leading-relaxed">
                    {insights.todaysFocus}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Lightbulb className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Insights Available</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Make sure you{"'"}ve configured your Azure DevOps connection and AI
              provider in Settings, then sync your commits.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
