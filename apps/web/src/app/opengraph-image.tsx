import { parseFont, svgText } from "@repo/social-image";
import { ImageResponse } from "next/og";

import { APP_NAME, APP_TAGLINE, APP_TITLE, SITE_URL } from "@/lib/constants";
import manrope from "@/lib/fonts/manrope-semibold.json" with { type: "json" };
import { BRAND_INK, THEME_COLORS } from "@/lib/theme-colors";

const alt = APP_TITLE;
const size = { height: 630, width: 1200 };
const contentType = "image/png";

const display = parseFont(Buffer.from(manrope.base64, "base64"));

const ROWS = [
  { label: "Los Angeles", start: 220, width: 420 },
  { label: "New York", start: 160, width: 420 },
  { label: "Lisbon", start: 80, width: 420 },
  { label: "Berlin", start: 40, width: 420 },
];

const COLORS = { muted: "#a3a3a3", track: "#171717", working: "#737373" };

const OpengraphImage = () =>
  new ImageResponse(
    <svg height={630} viewBox="0 0 1200 630" width={1200}>
      <rect fill={THEME_COLORS.dark} height={630} width={1200} />
      {svgText(APP_TAGLINE, {
        color: BRAND_INK,
        font: display,
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
      {svgText(APP_NAME, { color: BRAND_INK, font: display, size: 30, x: 110, y: 558 })}
      {svgText(`Free and open source · ${new URL(SITE_URL).host}`, {
        anchor: "end",
        color: COLORS.muted,
        size: 20,
        x: 1136,
        y: 558,
      })}
    </svg>,
    size,
  );

export { alt, contentType, size };
export default OpengraphImage;
