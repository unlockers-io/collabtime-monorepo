import { renderBrandMark } from "@/lib/brand-mark";

// public-route: the app's brand icon, a static image
const GET = () => renderBrandMark(512);

export { GET };
