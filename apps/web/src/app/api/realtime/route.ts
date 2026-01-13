import { handle } from "@upstash/realtime";
import { realtime } from "@/lib/realtime";

// Match timeout to realtime config for serverless environments
export const maxDuration = 300;

const GET = handle({ realtime });

export { GET };
