"use client";

import { createContext, useContext, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, WifiOff, KeyRound, CreditCard, ServerCrash } from "lucide-react";

type ErrorType = "generic" | "network" | "auth" | "quota" | "server";

interface AppError {
  title: string;
  message: string;
  type: ErrorType;
  action?: { label: string; href?: string; onClick?: () => void };
}

interface ErrorModalContextValue {
  showError: (error: AppError) => void;
  showApiError: (error: unknown, fallbackMessage?: string) => void;
}

const ErrorModalContext = createContext<ErrorModalContextValue | null>(null);

export function useErrorModal() {
  const ctx = useContext(ErrorModalContext);
  if (!ctx) throw new Error("useErrorModal must be used within ErrorModalProvider");
  return ctx;
}

const ICONS: Record<ErrorType, React.ReactNode> = {
  generic: <AlertTriangle className="w-6 h-6 text-destructive" />,
  network: <WifiOff className="w-6 h-6 text-yellow-500" />,
  auth: <KeyRound className="w-6 h-6 text-orange-500" />,
  quota: <CreditCard className="w-6 h-6 text-yellow-500" />,
  server: <ServerCrash className="w-6 h-6 text-destructive" />,
};

function classifyError(message: string, status?: number): ErrorType {
  if (status === 401 || message.toLowerCase().includes("unauthorized")) return "auth";
  if (
    message.toLowerCase().includes("quota") ||
    message.toLowerCase().includes("rate") ||
    message.toLowerCase().includes("insufficient balance") ||
    status === 429 ||
    status === 402
  )
    return "quota";
  if (
    message.toLowerCase().includes("failed to fetch") ||
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("econnrefused")
  )
    return "network";
  if (status && status >= 500) return "server";
  return "generic";
}

function getErrorDetails(type: ErrorType): { title: string; hint: string } {
  switch (type) {
    case "auth":
      return {
        title: "Authentication Error",
        hint: "Your session may have expired. Try signing in again.",
      };
    case "quota":
      return {
        title: "AI Quota Exceeded",
        hint: "Your AI provider rate limit or balance is exhausted. Switch to a different provider in Settings or wait a few minutes.",
      };
    case "network":
      return {
        title: "Connection Error",
        hint: "Could not reach the server. Check your internet connection and try again.",
      };
    case "server":
      return {
        title: "Server Error",
        hint: "Something went wrong on the server. Please try again in a moment.",
      };
    default:
      return {
        title: "Something went wrong",
        hint: "An unexpected error occurred. Please try again.",
      };
  }
}

export function ErrorModalProvider({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<AppError | null>(null);
  const [open, setOpen] = useState(false);

  const showError = useCallback((err: AppError) => {
    setError(err);
    setOpen(true);
  }, []);

  const showApiError = useCallback(
    (err: unknown, fallbackMessage = "An unexpected error occurred") => {
      let message = fallbackMessage;
      let status: number | undefined;

      if (err instanceof Error) {
        message = err.message;
        const statusMatch = message.match(/\b(\d{3})\b/);
        if (statusMatch) status = parseInt(statusMatch[1]);
      }

      const type = classifyError(message, status);
      const details = getErrorDetails(type);

      const action =
        type === "quota"
          ? { label: "Go to Settings", href: "/settings" }
          : type === "auth"
            ? { label: "Sign In", href: "/login" }
            : undefined;

      showError({
        title: details.title,
        message,
        type,
        action,
      });
    },
    [showError]
  );

  return (
    <ErrorModalContext.Provider value={{ showError, showApiError }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {error && ICONS[error.type]}
              <DialogTitle>{error?.title}</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-sm leading-relaxed">
              {error?.message}
            </DialogDescription>
          </DialogHeader>

          {error?.type && (
            <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground">
              {getErrorDetails(error.type).hint}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {error?.action && (
              <Button
                variant="outline"
                onClick={() => {
                  if (error.action?.href) {
                    window.location.href = error.action.href;
                  }
                  error.action?.onClick?.();
                  setOpen(false);
                }}
              >
                {error.action.label}
              </Button>
            )}
            <Button onClick={() => setOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErrorModalContext.Provider>
  );
}
