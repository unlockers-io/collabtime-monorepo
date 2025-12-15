import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { ModeToggle } from "@/components/mode-toggle";
import "@/styles/globals.css";
import { Toaster } from "sonner";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Collab Time - Team Timezone Visualizer",
    template: "%s | Collab Time",
  },
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
  authors: [{ name: "Collab Time" }],
  creator: "Collab Time",
  metadataBase: new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Collab Time",
    title: "Collab Time - Team Timezone Visualizer",
    description:
      "Visualize your team's working hours across timezones. Find the perfect moment to connect.",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: "Collab Time - Team Timezone Visualizer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Collab Time - Team Timezone Visualizer",
    description:
      "Visualize your team's working hours across timezones. Find the perfect moment to connect.",
    images: ["/og"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistMono.variable} font-(family-name:--font-geist-mono) antialiased bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 selection:bg-neutral-200 selection:text-neutral-900 min-h-screen flex flex-col`}
      >
        <Providers>
          <div className="flex-1 flex flex-col">
            {children}
          </div>
          <footer className="border-t border-neutral-200 px-4 py-6 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
              <span>© {new Date().getFullYear()} Collab Time. All rights reserved.</span>
              <a
                href="https://github.com/pedroapfilho/collab-time"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                aria-label="View on GitHub"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-5 w-5 fill-current"
                >
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
                toast:
                  "border border-neutral-200/80 bg-white text-neutral-900 shadow-lg dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50",
                title: "font-semibold",
                description: "text-sm text-neutral-600 dark:text-neutral-300",
                actionButton:
                  "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200",
                cancelButton:
                  "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                closeButton:
                  "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100",
                success:
                  "border border-amber-400/40 bg-neutral-50 text-neutral-900 shadow-lg dark:border-amber-300/30 dark:bg-neutral-900 dark:text-neutral-50",
                error:
                  "border border-red-400/50 bg-neutral-50 text-neutral-900 shadow-lg dark:border-red-400/40 dark:bg-neutral-900 dark:text-neutral-50",
                info:
                  "border border-sky-400/40 bg-neutral-50 text-neutral-900 shadow-lg dark:border-sky-300/30 dark:bg-neutral-900 dark:text-neutral-50",
                warning:
                  "border border-amber-400/50 bg-neutral-50 text-neutral-900 shadow-lg dark:border-amber-300/40 dark:bg-neutral-900 dark:text-neutral-50",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
};

export default RootLayout;
