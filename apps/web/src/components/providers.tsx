"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/providers/query-provider";

type ProvidersProps = { children: ReactNode };

const RealtimeReadyContext = createContext(false);

const useRealtimeReady = () => useContext(RealtimeReadyContext);

type RealtimeProviderComponent = React.ComponentType<{
  api: { url: string };
  children: ReactNode;
}>;

// @upstash/realtime does not ship "use client" in its dist files. Next.js 16
// + Turbopack resolves `react` via react-server exports for SSR bundles, which
// lack createContext, causing a build crash. Breaking the static import with a
// dynamic import() inside useEffect prevents the package from entering the SSR
// bundle entirely.
const RealtimeMount = ({ children }: { children: ReactNode }) => {
  const [provider, setProvider] = useState<RealtimeProviderComponent | null>(null);

  useEffect(() => {
    const load = async () => {
      const m = await import("@upstash/realtime/client");
      setProvider(() => m.RealtimeProvider as RealtimeProviderComponent);
    };
    void load();
  }, []);

  if (!provider) {
    return <RealtimeReadyContext value={false}>{children}</RealtimeReadyContext>;
  }
  const Provider = provider;
  return (
    <Provider api={{ url: "/api/realtime" }}>
      <RealtimeReadyContext value>{children}</RealtimeReadyContext>
    </Provider>
  );
};

const Providers = ({ children }: ProvidersProps) => (
  <QueryProvider>
    <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
      <RealtimeMount>{children}</RealtimeMount>
    </ThemeProvider>
  </QueryProvider>
);

export { Providers, useRealtimeReady };
