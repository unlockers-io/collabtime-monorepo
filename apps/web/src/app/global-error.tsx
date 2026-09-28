"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect, useRef } from "react";

import styles from "./global-error.module.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const THEME_SCRIPT = `try{var t=localStorage.getItem("theme")||"system";var r=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;document.documentElement.style.colorScheme=r==="dark"?"dark":"light"}catch(e){}`;

const GlobalError = ({ error, reset }: GlobalErrorProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    captureException(error);
    headingRef.current?.focus();
  }, [error]);

  return (
    <html className={styles.document} lang="en" suppressHydrationWarning>
      <head>
        {/* oxlint-disable-next-line react/no-danger -- blocking the parser is the point (the scheme must settle before first paint) and next/script's beforeInteractive is ignored outside the root layout; the body is a literal, no user data */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={styles.body}>
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
          {error.digest !== undefined && <p className={styles.digest}>Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
};

export default GlobalError;
