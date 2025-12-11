"use client";

import { RealtimeProvider } from "@upstash/realtime/client";
import { ThemeProvider } from "@/components/theme-provider";

type ProvidersProps = {
  children: React.ReactNode;
};

const Providers = ({ children }: ProvidersProps) => {
  return (
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
  );
};

export { Providers };
