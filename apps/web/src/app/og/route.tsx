import { ImageResponse } from "next/og";

export const runtime = "edge";

const loadGoogleFont = async (font: string, weight: number, text: string) => {
  const url = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const resource = css.match(
    /src: url\((.+)\) format\('(opentype|truetype)'\)/
  );

  if (resource) {
    const response = await fetch(resource[1]);
    if (response.status === 200) {
      return await response.arrayBuffer();
    }
  }

  throw new Error("failed to load font data");
};

const GET = async () => {
  const title = "Collab Time";
  const subtitle = "Visualize your team's working hours across timezones";

  const results = await Promise.allSettled([
    loadGoogleFont("Geist+Mono", 700, title),
    loadGoogleFont("Geist+Mono", 400, subtitle),
  ]);

  const fontBold =
    results[0].status === "fulfilled" ? results[0].value : null;
  const fontRegular =
    results[1].status === "fulfilled" ? results[1].value : null;

  if (!fontBold || !fontRegular) {
    throw new Error("Failed to load fonts");
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          fontFamily: "Geist Mono",
        }}
      >
        {/* Globe icon */}
        <div
          style={{
            display: "flex",
            width: 96,
            height: 96,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 24,
            backgroundColor: "#fafafa",
            marginBottom: 32,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0a0a0a"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontFamily: "Geist Mono Bold",
            color: "#fafafa",
            marginBottom: 16,
            letterSpacing: "-0.025em",
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            fontFamily: "Geist Mono",
            color: "#a3a3a3",
            textAlign: "center",
            maxWidth: 600,
          }}
        >
          {subtitle}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Geist Mono Bold",
          data: fontBold,
          style: "normal",
          weight: 700,
        },
        {
          name: "Geist Mono",
          data: fontRegular,
          style: "normal",
          weight: 400,
        },
      ],
    }
  );
};

export { GET };
