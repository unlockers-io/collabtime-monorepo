import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
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
    <html lang="en">
      <body
        className={`${geistMono.variable} font-(family-name:--font-geist-mono) antialiased bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 selection:bg-neutral-200 selection:text-neutral-900`}
      >
        <Providers>
          {children}
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
