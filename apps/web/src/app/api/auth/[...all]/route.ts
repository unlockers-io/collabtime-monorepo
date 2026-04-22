import type { NextRequest } from "next/server";

import { getAuth } from "@/lib/auth-server";

export const GET = (request: NextRequest) => {
  const auth = getAuth();
  return auth.handler(request);
};

export const POST = (request: NextRequest) => {
  const auth = getAuth();
  return auth.handler(request);
};
