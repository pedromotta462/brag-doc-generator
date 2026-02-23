"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorModalProvider } from "@/components/error-modal";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TooltipProvider>
        <ErrorModalProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ErrorModalProvider>
      </TooltipProvider>
    </SessionProvider>
  );
}
