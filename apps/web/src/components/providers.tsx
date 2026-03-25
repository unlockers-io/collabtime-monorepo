"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/providers/query-provider";

type ProvidersProps = { children: ReactNode };

const RealtimeReadyContext = createContext(false);

const useRealtimeReady = () => useContext(RealtimeReadyContext);

// @upstash/realtime does not ship "use client" in its dist files. Next.js 16
// + Turbopack resolves `react` via react-server exports for SSR bundles, which
// lack createContext, causing a build crash. Breaking the static import with a
// dynamic import() inside useEffect prevents the package from entering the SSR
// bundle entirely.
const RealtimeMount = ({ children }: { children: ReactNode }) => {
  const [Provider, setProvider] = useState<React.ComponentType<{
    api: { url: string };
    children: ReactNode;
  }> | null>(null);

  useEffect(() => {
    void import("@upstash/realtime/client").then((m) => {
      setProvider(
        () =>
          m.RealtimeProvider as React.ComponentType<{
            api: { url: string };
            children: ReactNode;
          }>,
      );
    });
  }, []);

  if (!Provider) {
    return <RealtimeReadyContext value={false}>{children}</RealtimeReadyContext>;
  }
  return (
    <Provider api={{ url: "/api/realtime" }}>
      <RealtimeReadyContext value={true}>{children}</RealtimeReadyContext>
    </Provider>
  );
};

const Providers = ({ children }: ProvidersProps) => (
  <QueryProvider>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <RealtimeMount>{children}</RealtimeMount>
    </ThemeProvider>
  </QueryProvider>
);

export { Providers, useRealtimeReady };
