"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

const readYear = () => new Date().getFullYear();

const CopyrightYear = () => (
  <span suppressHydrationWarning>{useSyncExternalStore(subscribe, readYear, readYear)}</span>
);

export { CopyrightYear };
