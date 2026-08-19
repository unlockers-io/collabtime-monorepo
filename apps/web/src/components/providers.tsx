"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";

type ProvidersProps = { children: ReactNode };

const Providers = ({ children }: ProvidersProps) => (
  <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  </ThemeProvider>
);

export { Providers };
