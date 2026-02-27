"use client";

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ToastProvider } from "./toast";
import { TopProgressBar } from "./top-progress-bar";
import { ErrorBoundary } from "./error-boundary";
import { PostHogProvider } from "./providers/posthog-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <TopProgressBar />
        <Suspense fallback={null}>
          <PostHogProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
          </PostHogProvider>
        </Suspense>
      </ToastProvider>
    </QueryClientProvider>
  );
}
