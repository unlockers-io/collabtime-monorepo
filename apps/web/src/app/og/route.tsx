import { parseFont, svgText } from "@repo/social-image";
import { ImageResponse } from "next/og";

import { getAppUrl } from "@/lib/app-url";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { log } from "@/lib/observability";
import { BRAND_INK, THEME_COLORS } from "@/lib/theme-colors";

const loadFont = async (): Promise<ArrayBuffer | null> => {
  try {
    const signal = AbortSignal.timeout(3000);
    const cssResponse = await fetch("https://fonts.googleapis.com/css2?family=Manrope:wght@600", {
      next: { revalidate: 86_400 },
      signal,
    });
    if (!cssResponse.ok) {
      throw new Error("Font stylesheet unavailable");
    }
    const css = await cssResponse.text();
    const url = /src: url\((?<url>.+)\) format\('(?:opentype|truetype)'\)/v.exec(css)?.groups?.url;
    if (url === undefined || url === "") {
      throw new Error("Font URL unavailable");
    }
    const response = await fetch(url, { next: { revalidate: 86_400 }, signal });
    if (!response.ok) {
      throw new Error("Font data unavailable");
    }
    return await response.arrayBuffer();
  } catch (error) {
    log.warn({ error, message: "Using default OG font", route: "/og" });
    return null;
  }
};

const ROWS = [
  { label: "Los Angeles", start: 220, width: 420 },
  { label: "New York", start: 160, width: 420 },
  { label: "Lisbon", start: 80, width: 420 },
  { label: "Berlin", start: 40, width: 420 },
];

const COLORS = { muted: "#a3a3a3", track: "#171717", working: "#737373" };
const GET = async () => {
  const data = await loadFont();
  const font = data ? parseFont(Buffer.from(data)) : undefined;
  const host = new URL(getAppUrl()).host;
  return new ImageResponse(
    <svg height={630} viewBox="0 0 1200 630" width={1200}>
      <rect fill={THEME_COLORS.dark} height={630} width={1200} />
      {svgText(APP_TAGLINE, {
        color: BRAND_INK,
        font,
        lineHeight: 1.1,
        size: 64,
        tracking: -1.92,
        width: 900,
        x: 64,
        y: 125,
      })}
      {ROWS.map(({ label, start, width }, index) => (
        <g key={label}>
          {svgText(label, { color: COLORS.muted, size: 20, x: 64, y: 273 + 44 * index })}
          <rect fill={COLORS.track} height={28} width={850} x={248} y={250 + 44 * index} />
          <rect
            fill={COLORS.working}
            height={28}
            width={width}
            x={248 + start}
            y={250 + 44 * index}
          />
          <rect fill={BRAND_INK} height={28} width={240} x={468} y={250 + 44 * index} />
        </g>
      ))}
      <rect fill="none" height={24} stroke={BRAND_INK} strokeWidth={4} width={24} x={66} y={534} />
      {svgText(APP_NAME, { color: BRAND_INK, font, size: 30, x: 110, y: 558 })}
      {svgText(`Free and open source · ${host}`, {
        anchor: "end",
        color: COLORS.muted,
        size: 20,
        x: 1136,
        y: 558,
      })}
    </svg>,
    {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
      height: 630,
      width: 1200,
    },
  );
};
export { GET };
