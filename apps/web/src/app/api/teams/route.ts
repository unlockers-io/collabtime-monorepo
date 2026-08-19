import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { getMyTeams } from "@/lib/home-data";
import { log, withEvlog } from "@/lib/observability";

export const GET = withEvlog(async () => {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teams = await getMyTeams(session.user.id);

    return NextResponse.json({ teams });
  } catch (error) {
    log.error({ error, message: "Failed to fetch teams", route: "/api/teams" });
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
});
