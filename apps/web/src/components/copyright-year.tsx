"use client";

// The current year is request-time data. Kept in its own client component and
// streamed behind a Suspense boundary so the static footer shell stays
// prerenderable under Cache Components instead of forcing a dynamic render.
const CopyrightYear = () => <span suppressHydrationWarning>{new Date().getFullYear()}</span>;

export { CopyrightYear };
