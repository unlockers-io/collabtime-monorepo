"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect, useRef } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// global-error replaces the root layout, so globals.css never loads here and Tailwind
// classes would resolve to nothing. Every rule below has to be inline.
//
// The app resolves its theme from next-themes (`defaultTheme="system"`, storage key
// `theme`), whose own pre-paint script ships with the root layout this boundary replaces.
// Without the copy below, a visitor who picked Light on a dark-OS machine (or Dark on a
// light-OS one) would get an error page in the opposite scheme, because `light-dark()`
// reads `color-scheme` and nothing else would set it here. `next/script`'s
// `beforeInteractive` is only honored in the root layout, so a parser-blocking inline
// script is the only pre-paint hook available. Values outside light/dark/system resolve to
// light, which is where next-themes' script also lands them.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme")||"system";var r=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;document.documentElement.style.colorScheme=r==="dark"?"dark":"light"}catch(e){}`;

const styles = {
  body: {
    alignItems: "center",
    backgroundColor: "light-dark(#ffffff, #0a0a0a)",
    color: "light-dark(#0a0a0a, #fafafa)",
    display: "flex",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    justifyContent: "center",
    margin: 0,
    minHeight: "100vh",
    padding: "1.5rem",
  },
  button: {
    backgroundColor: "light-dark(#0a0a0a, #fafafa)",
    border: "none",
    borderRadius: "0.5rem",
    color: "light-dark(#fafafa, #0a0a0a)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "0.875rem",
    fontWeight: 500,
    minHeight: "2.75rem",
    padding: "0.625rem 1.25rem",
  },
  digest: {
    color: "light-dark(#71717a, #a1a1aa)",
    fontSize: "0.75rem",
    margin: 0,
  },
  heading: {
    fontSize: "1.5rem",
    fontWeight: 600,
    margin: 0,
  },
  main: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    maxWidth: "28rem",
    textAlign: "center",
  },
  text: {
    color: "light-dark(#52525b, #a1a1aa)",
    fontSize: "0.875rem",
    lineHeight: 1.6,
    margin: 0,
  },
} as const;

const GlobalError = ({ error, reset }: GlobalErrorProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    captureException(error);
    // The boundary unmounts whatever held focus, dropping it on <body>. Focusing the heading
    // both announces the failure and puts the keyboard caret inside the replacement content.
    headingRef.current?.focus();
  }, [error]);

  return (
    <html lang="en" style={{ colorScheme: "light dark" }} suppressHydrationWarning>
      <head>
        {/* oxlint-disable-next-line react-doctor/nextjs-no-native-script, react/no-danger -- blocking the parser is the point (the scheme must settle before first paint) and next/script's beforeInteractive is ignored outside the root layout; the body is a literal, no user data */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body style={styles.body}>
        <main style={styles.main}>
          <h1 ref={headingRef} style={styles.heading} tabIndex={-1}>
            Something went wrong
          </h1>
          <p style={styles.text}>
            The application stopped unexpectedly. Try again, and if the problem continues, reload
            the page or come back in a few minutes.
          </p>
          <button onClick={reset} style={styles.button} type="button">
            Try again
          </button>
          {error.digest !== undefined && <p style={styles.digest}>Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
};

export default GlobalError;
