import "./fields";

import { createLogger, initLogger } from "evlog";

import { buildConfig } from "./config";

const initWorkerLogger = (opts: { service: string }): void => {
  initLogger(buildConfig(opts.service));
};

type JobLogContext = { jobId: string; queue: string };

const createJobLogger = (ctx: JobLogContext) => createLogger(ctx);

export { createJobLogger, initWorkerLogger };
