"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";

import { TeamUnavailable } from "./team-unavailable";

const TeamError = ({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) => {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return <TeamUnavailable message="Please try again in a moment." onRetry={retry} />;
};

export default TeamError;
