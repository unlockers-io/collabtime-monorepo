"use client";

import { ThemeProvider } from "@repo/ui/compositions/theme-provider";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { ThemeColorSync } from "@/components/theme-color-sync";

type ProvidersProps = { children: ReactNode };

const Providers = ({ children }: ProvidersProps) => (
  <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
    <ThemeColorSync />
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  </ThemeProvider>
);

export { Providers };
