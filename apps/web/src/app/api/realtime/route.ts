import { handle } from "@upstash/realtime";

import { realtime } from "@/lib/realtime";

const GET = handle({ realtime });

export { GET };
