"use client";

import { createRealtime } from "@upstash/realtime/client";
import type { RealtimeEvents } from "./realtime";

const { useRealtime } = createRealtime<RealtimeEvents>();

export { useRealtime };
