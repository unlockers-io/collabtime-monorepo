"use client";

import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/providers/query-provider";

type ProvidersProps = { children: ReactNode };

const Providers = ({ children }: ProvidersProps) => (
  <QueryProvider>
    <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
      {children}
    </ThemeProvider>
  </QueryProvider>
);

export { Providers };
