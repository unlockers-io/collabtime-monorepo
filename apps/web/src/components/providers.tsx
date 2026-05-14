"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/providers/query-provider";

type ProvidersProps = { children: ReactNode };

// `reducedMotion="user"` honors `prefers-reduced-motion: reduce` (WCAG 2.3.3).
// `LazyMotion` with `domAnimation` lets descendants use the lightweight `m`
// component and lazy-loads animation features (~30kb smaller than `motion`).
const Providers = ({ children }: ProvidersProps) => (
  <QueryProvider>
    <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  </QueryProvider>
);

export { Providers };
