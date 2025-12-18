"use client";

import { RealtimeProvider } from "@upstash/realtime/client";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/providers/query-provider";

type ProvidersProps = {
  children: React.ReactNode;
};

const Providers = ({ children }: ProvidersProps) => {
  return (
    <QueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <RealtimeProvider api={{ url: "/api/realtime" }}>
          {children}
        </RealtimeProvider>
      </ThemeProvider>
    </QueryProvider>
  );
};

export { Providers };
