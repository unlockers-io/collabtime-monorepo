"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

import { THEME_COLORS } from "@/lib/theme-colors";

/**
 * The theme-color metas Next renders are keyed on `prefers-color-scheme`, but the page follows
 * the stored next-themes choice. Rewrite both metas to the resolved theme so browser chrome
 * matches the page.
 */
const ThemeColorSync = () => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "dark" && resolvedTheme !== "light") {
      return;
    }

    const color = THEME_COLORS[resolvedTheme];

    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = color;
    }
  }, [resolvedTheme]);

  return null;
};

export { ThemeColorSync };
