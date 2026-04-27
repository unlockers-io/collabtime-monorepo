import "@/styles/globals.css";

import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { Providers } from "@/components/providers";

export const dynamic = "force-dynamic";

// oxlint-disable-next-line new-cap -- next/font/google fonts are factory calls, not constructors
const geistMono = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  authors: [{ name: "Collab Time" }],
  creator: "Collab Time",
  description:
    "Visualize your team's working hours across timezones. Find the perfect moment to connect with distributed teams. No account required.",
  keywords: [
    "timezone",
    "team collaboration",
    "remote work",
    "distributed teams",
    "working hours",
    "time zones",
    "meeting planner",
    "overlap hours",
  ],
  metadataBase: new URL(
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000",
  ),
  openGraph: {
    description:
      "Visualize your team's working hours across timezones. Find the perfect moment to connect.",
    images: [
      {
        alt: "Collab Time - Team Timezone Visualizer",
        height: 630,
        url: "/og",
        width: 1200,
      },
    ],
    locale: "en_US",
    siteName: "Collab Time",
    title: "Collab Time - Team Timezone Visualizer",
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
    default: "Collab Time - Team Timezone Visualizer",
    template: "%s - Collab Time",
  },
  twitter: {
    card: "summary_large_image",
    description:
      "Visualize your team's working hours across timezones. Find the perfect moment to connect.",
    images: ["/og"],
    title: "Collab Time - Team Timezone Visualizer",
  },
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // oxlint-disable-next-line react/no-danger -- Inline theme bootstrap script avoids FOUC; literal HTML, no user data
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t||t==='system')&&matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()`,
          }}
        />
      </head>
      {process.env.NODE_ENV === "development" && !process.env.CI && (
        <>
          <script
            async
            crossOrigin="anonymous"
            src="https://unpkg.com/react-scan/dist/auto.global.js"
          />
          <script
            async
            crossOrigin="anonymous"
            src="https://unpkg.com/react-grab/dist/index.global.js"
          />
        </>
      )}
      <body
        className={`${geistMono.variable} flex min-h-screen flex-col bg-background font-(family-name:--font-geist-mono) text-foreground antialiased selection:bg-accent selection:text-accent-foreground`}
      >
        <Providers>
          <div className="flex flex-1 flex-col">{children}</div>
          <footer className="border-t border-border px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8 xl:px-12">
            <div className="mx-auto flex w-full max-w-450 items-center justify-between gap-3">
              <span>© {new Date().getFullYear()} Collab Time. All rights reserved.</span>
              <a
                aria-label="View on GitHub"
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                href="https://github.com/unlockers-io/collabtime-monorepo"
                rel="noreferrer"
                target="_blank"
              >
                <svg aria-hidden="true" className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 .5C5.648.5.5 5.648.5 12c0 5.092 3.292 9.403 7.868 10.936.575.103.785-.25.785-.556 0-.274-.01-1.17-.015-2.122-3.2.695-3.878-1.368-3.878-1.368-.523-1.328-1.277-1.683-1.277-1.683-1.043-.713.079-.698.079-.698 1.153.081 1.76 1.184 1.76 1.184 1.026 1.758 2.69 1.25 3.345.956.104-.743.402-1.25.73-1.538-2.554-.292-5.238-1.277-5.238-5.683 0-1.255.45-2.281 1.184-3.085-.119-.292-.513-1.468.112-3.06 0 0 .965-.309 3.163 1.178a11.05 11.05 0 0 1 2.88-.388c.977.004 1.962.132 2.88.388 2.197-1.487 3.16-1.178 3.16-1.178.627 1.592.233 2.768.114 3.06.737.804 1.182 1.83 1.182 3.085 0 4.418-2.69 5.387-5.256 5.674.41.354.777 1.053.777 2.122 0 1.532-.014 2.767-.014 3.144 0 .309.207.665.79.552C20.71 21.4 24 17.09 24 12 24 5.648 18.352.5 12 .5Z" />
                </svg>
                <span className="hidden sm:inline">GitHub</span>
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
                success: "border border-warning/40 bg-popover text-popover-foreground shadow-lg",
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
