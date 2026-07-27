import "@/styles/globals.css";

import { Toaster } from "@repo/ui/components/sonner";
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Suspense } from "react";

import { CopyrightYear } from "@/components/copyright-year";
import { GithubIcon } from "@/components/github-icon";
import { Providers } from "@/components/providers";
import { getAppUrl } from "@/lib/app-url";
import {
  APP_DESCRIPTION,
  APP_DESCRIPTION_SHORT,
  APP_KEYWORDS,
  APP_NAME,
  APP_REPO_URL,
  APP_TITLE,
} from "@/lib/constants";

const geistMono = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: [
    { color: "oklch(1 0 0)", media: "(prefers-color-scheme: light)" },
    { color: "oklch(0.145 0 0)", media: "(prefers-color-scheme: dark)" },
  ],
};

export const metadata: Metadata = {
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  description: APP_DESCRIPTION,
  keywords: APP_KEYWORDS,
  metadataBase: new URL(getAppUrl()),
  openGraph: {
    description: APP_DESCRIPTION_SHORT,
    images: [
      {
        alt: APP_TITLE,
        height: 630,
        url: "/og",
        width: 1200,
      },
    ],
    locale: "en_US",
    siteName: APP_NAME,
    title: APP_TITLE,
    type: "website",
  },
  robots: {
    follow: true,
    googleBot: {
      follow: true,
      index: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    index: true,
  },
  title: {
    default: APP_TITLE,
    template: `%s - ${APP_NAME}`,
  },
  twitter: {
    card: "summary_large_image",
    description: APP_DESCRIPTION_SHORT,
    images: ["/og"],
    title: APP_TITLE,
  },
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html className="antialiased" lang="en" suppressHydrationWarning>
      <body
        className={`${geistMono.variable} ${inter.variable} flex min-h-dvh flex-col bg-background font-sans text-foreground selection:bg-accent selection:text-accent-foreground`}
      >
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus:ring-2 focus:ring-ring focus:outline-none"
          href="#main"
        >
          Skip to content
        </a>
        <Providers>
          <div className="isolate flex flex-1 flex-col">{children}</div>
          <footer className="border-t border-border px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8 xl:px-12">
            <div className="mx-auto flex w-full max-w-450 items-center justify-between gap-3">
              <span>
                ©{" "}
                <Suspense fallback={null}>
                  <CopyrightYear />
                </Suspense>{" "}
                Collab Time. All rights reserved.
              </span>
              <a
                aria-label="View on GitHub"
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                href={APP_REPO_URL}
                rel="noreferrer"
                target="_blank"
              >
                <GithubIcon />
                <span className="max-sm:hidden">GitHub</span>
              </a>
            </div>
          </footer>
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                actionButton: "bg-primary text-primary-foreground hover:bg-primary/90",
                cancelButton: "text-muted-foreground hover:bg-accent",
                closeButton: "text-muted-foreground hover:text-foreground",
                description: "text-sm text-muted-foreground",
                error: "border border-destructive/50 bg-popover text-popover-foreground shadow-lg",
                info: "border border-info/40 bg-popover text-popover-foreground shadow-lg",
                success: "border border-success/40 bg-popover text-popover-foreground shadow-lg",
                title: "font-semibold",
                toast: "border border-border bg-popover text-popover-foreground shadow-lg",
                warning: "border border-warning/50 bg-popover text-popover-foreground shadow-lg",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
};

export default RootLayout;
