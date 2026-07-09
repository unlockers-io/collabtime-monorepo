"use client";

// Request-time year; streamed behind Suspense so the footer shell stays prerenderable.
const CopyrightYear = () => <span suppressHydrationWarning>{new Date().getFullYear()}</span>;

export { CopyrightYear };
