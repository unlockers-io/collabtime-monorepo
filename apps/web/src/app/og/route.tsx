import { ImageResponse } from "next/og";

import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

const loadGoogleFont = async (font: string, weight: number, text: string) => {
  const url = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&text=${encodeURIComponent(text)}`;
  // 24h cache keeps OG generation off the cold-start critical path.
  const cssResponse = await fetch(url, { next: { revalidate: 86_400 } });
  const css = await cssResponse.text();
  const fontUrl = /src: url\((?<url>.+)\) format\('(?:opentype|truetype)'\)/v.exec(css)?.groups
    ?.url;

  if (fontUrl !== undefined && fontUrl !== "") {
    const response = await fetch(fontUrl, { next: { revalidate: 86_400 } });
    if (response.status === 200) {
      return response.arrayBuffer();
    }
  }

  throw new Error("failed to load font data");
};

const GET = async () => {
  const title = APP_NAME;
  const subtitle = APP_TAGLINE;

  const results = await Promise.allSettled([
    loadGoogleFont("Geist+Mono", 700, title),
    loadGoogleFont("Geist+Mono", 400, subtitle),
  ]);

  const fontBold = results[0].status === "fulfilled" ? results[0].value : null;
  const fontRegular = results[1].status === "fulfilled" ? results[1].value : null;

  if (!fontBold || !fontRegular) {
    throw new Error("Failed to load fonts");
  }

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        backgroundColor: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Geist Mono",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          backgroundColor: "#fafafa",
          borderRadius: 24,
          display: "flex",
          height: 96,
          justifyContent: "center",
          marginBottom: 32,
          width: 96,
        }}
      >
        <svg
          fill="none"
          height="48"
          stroke="#0a0a0a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
          width="48"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      </div>

      <div
        style={{
          color: "#fafafa",
          fontFamily: "Geist Mono Bold",
          fontSize: 64,
          letterSpacing: "-0.025em",
          marginBottom: 16,
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: "#a3a3a3",
          fontFamily: "Geist Mono",
          fontSize: 24,
          maxWidth: 600,
          textAlign: "center",
        }}
      >
        {subtitle}
      </div>
    </div>,
    {
      fonts: [
        {
          data: fontBold,
          name: "Geist Mono Bold",
          style: "normal",
          weight: 700,
        },
        {
          data: fontRegular,
          name: "Geist Mono",
          style: "normal",
          weight: 400,
        },
      ],
      height: 630,
      width: 1200,
    },
  );
};

export { GET };
