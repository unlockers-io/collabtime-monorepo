"use client";

import { ThemeProvider } from "@repo/ui/compositions/theme-provider";
import { useErrorReport } from "@repo/ui/hooks/use-error-report";
import type { BoundaryError } from "@repo/ui/hooks/use-error-report";
import { captureException } from "@sentry/nextjs";

import styles from "./global-error.module.css";

const report = (error: BoundaryError) => {
  captureException(error);
};

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const GlobalError = ({ error, reset }: GlobalErrorProps) => {
  const headingRef = useErrorReport(error, report);

  return (
    <html className={styles.document} lang="en" suppressHydrationWarning>
      <body className={styles.body}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <main className={styles.main}>
            <h1 className={styles.heading} ref={headingRef} tabIndex={-1}>
              Something went wrong
            </h1>
            <p className={styles.text}>
              The application stopped unexpectedly. Try again, and if the problem continues, reload
              the page or come back in a few minutes.
            </p>
            <button className={styles.button} onClick={reset} type="button">
              Try again
            </button>
            {error.digest !== undefined && (
              <p className={styles.digest}>Reference: {error.digest}</p>
            )}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default GlobalError;
