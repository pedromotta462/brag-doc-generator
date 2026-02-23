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
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api-client";
import { useErrorModal } from "@/components/error-modal";

interface WeekDay {
  date: string;
  dayName: string;
  hasCommits: boolean;
  hasCachedInsight: boolean;
}

interface DailyInsights {
  todaysFocus: string;
  recentAchievements: string[];
  suggestedStandup: string;
}

export default function DailyInsightsPage() {
  const { showApiError } = useErrorModal();
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [weekLoading, setWeekLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [insights, setInsights] = useState<DailyInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadWeek = useCallback(async () => {
    try {
      const data = await apiFetch<{ weekDays: WeekDay[] }>("/api/insights");
      setWeekDays(data.weekDays);

      const today = new Date().toISOString().split("T")[0];
      const daysWithCommits = data.weekDays.filter((d) => d.hasCommits);

      if (daysWithCommits.length > 0) {
        const todayOrBefore = daysWithCommits.filter((d) => d.date <= today);
        if (todayOrBefore.length > 0) {
          setSelectedDate(todayOrBefore[todayOrBefore.length - 1].date);
        } else {
          setSelectedDate(daysWithCommits[0].date);
        }
      }
    } catch (err) {
      showApiError(err, "Failed to load week data");
    } finally {
      setWeekLoading(false);
    }
  }, [showApiError]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  const loadInsightsForDate = useCallback(
    async (date: string, forceRefresh = false) => {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setInsightsLoading(true);
      }
      setInsights(null);

      try {
        const data = forceRefresh
          ? await apiFetch<DailyInsights>("/api/insights", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date }),
            })
          : await apiFetch<DailyInsights>(`/api/insights?date=${date}`);
        setInsights(data);
        if (forceRefresh) {
          toast.success("Insights regenerated!");
          setWeekDays((prev) =>
            prev.map((d) =>
              d.date === date ? { ...d, hasCachedInsight: true } : d
            )
          );
        }
      } catch (err) {
        showApiError(err, "Failed to load insights");
      } finally {
        setInsightsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showApiError]
  );

  useEffect(() => {
    if (selectedDate) {
      loadInsightsForDate(selectedDate);
    }
  }, [selectedDate, loadInsightsForDate]);

  const copyStandup = () => {
    if (insights?.suggestedStandup) {
      navigator.clipboard.writeText(insights.suggestedStandup);
      toast.success("Standup text copied to clipboard!");
    }
  };

  const isToday = (date: string) =>
    date === new Date().toISOString().split("T")[0];

  if (weekLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Daily Insights</h1>
          <p className="text-muted-foreground">
            AI-powered standup suggestions based on each day{"'"}s commits.
          </p>
        </div>
        {selectedDate && (
          <Button
            variant="outline"
            onClick={() => loadInsightsForDate(selectedDate, true)}
            disabled={isRefreshing}
            className="gap-2"
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isRefreshing ? "Generating..." : "Regenerate"}
          </Button>
        )}
      </div>

      {/* Week day selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">This Week</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {weekDays.map((day) => {
              const selected = selectedDate === day.date;
              const dayDate = new Date(day.date + "T12:00:00");
              return (
                <button
                  key={day.date}
                  onClick={() => {
                    if (day.hasCommits) setSelectedDate(day.date);
                  }}
                  disabled={!day.hasCommits}
                  className={`
                    flex flex-col items-center justify-center gap-0.5 py-3 px-2 rounded-xl border transition-all text-center
                    ${
                      selected
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : day.hasCommits
                          ? "border-border/60 hover:border-primary/50 hover:bg-muted/50 cursor-pointer"
                          : "border-border/30 opacity-40 cursor-not-allowed"
                    }
                  `}
                >
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      selected ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {day.dayName}
                  </span>
                  <span
                    className={`text-lg font-bold leading-tight ${
                      selected ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {format(dayDate, "d")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(dayDate, "MMM")}
                  </span>
                  <div className="flex items-center gap-1.5 h-3 mt-0.5">
                    {isToday(day.date) && (
                      <span className="w-2 h-2 rounded-full bg-primary" />
                    )}
                    {day.hasCommits && day.hasCachedInsight && (
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Today
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Cached insight
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-border/60 rounded" />
              No commits
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Selected day insights */}
      {!selectedDate ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No Commits This Week
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Sync your Azure DevOps data to see daily insights for this week.
            </p>
          </CardContent>
        </Card>
      ) : insightsLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Generating insights for{" "}
            {format(new Date(selectedDate + "T12:00:00"), "EEEE, MMM d")}...
          </p>
        </div>
      ) : insights ? (
        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">
            Showing insights for{" "}
            <span className="font-semibold text-foreground">
              {format(new Date(selectedDate + "T12:00:00"), "EEEE, MMMM d, yyyy")}
            </span>
          </div>

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
                What I Did
              </CardTitle>
              <CardDescription>
                Based on commits from{" "}
                {format(new Date(selectedDate + "T12:00:00"), "MMM d")}.
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
                  No achievements found for this day.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Focus */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Focus Suggestion
              </CardTitle>
              <CardDescription>
                AI suggestion based on this day{"'"}s work.
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
      ) : null}
    </div>
  );
}
