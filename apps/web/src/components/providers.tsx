"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/providers/query-provider";

type ProvidersProps = { children: ReactNode };

// `reducedMotion="user"` honors `prefers-reduced-motion: reduce` (WCAG 2.3.3)
const Providers = ({ children }: ProvidersProps) => (
  <QueryProvider>
    <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeProvider>
  </QueryProvider>
);

export { Providers };
