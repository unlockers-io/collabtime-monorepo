import type { NextRequest } from "next/server";

import { getAuth } from "@/lib/auth-server";

const handler = (request: NextRequest) => getAuth().handler(request);

export const GET = handler;
export const POST = handler;
