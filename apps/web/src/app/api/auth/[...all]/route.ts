import type { NextRequest } from "next/server";

import { getAuth } from "@/lib/auth-server";

export const GET = async (request: NextRequest) => {
  const auth = getAuth();
  return auth.handler(request);
};

export const POST = async (request: NextRequest) => {
  const auth = getAuth();
  return auth.handler(request);
};
