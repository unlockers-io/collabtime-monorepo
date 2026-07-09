import "./fields";

import { initLogger } from "evlog";
import { evlog } from "evlog/hono";

import { buildConfig } from "./config";

const initApiLogger = (opts: { service: string }): void => {
  initLogger(buildConfig(opts.service));
};

const honoEvlog = () => evlog();

// The API needs a module-level `log` for startup/shutdown lines without importing
// `@repo/observability/next` (which is React-coupled). Re-exported from evlog root.
export { honoEvlog, initApiLogger };
export { log } from "evlog";
export type { EvlogVariables } from "evlog/hono";
