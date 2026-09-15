import { ImageResponse } from "next/og";

import { BRAND_INK, THEME_COLORS } from "@/lib/theme-colors";

const ICON_CACHE_CONTROL = "public, max-age=86400, s-maxage=86400, immutable";
const renderBrandMark = (size: number) => {
  const side = Math.round(size * 0.4375);
  const stroke = Math.max(2, Math.round(size * 0.0625));
  const offset = (size - side + stroke) / 2;
  return new ImageResponse(
    <svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
      <rect fill={THEME_COLORS.dark} height={size} width={size} />
      <rect
        fill="none"
        height={side - stroke}
        stroke={BRAND_INK}
        strokeWidth={stroke}
        width={side - stroke}
        x={offset}
        y={offset}
      />
    </svg>,
    { headers: { "Cache-Control": ICON_CACHE_CONTROL }, height: size, width: size },
  );
};
export { renderBrandMark };
