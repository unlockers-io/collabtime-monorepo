import { NextResponse } from "next/server";
import { getTeam } from "@/lib/actions";

type Params = {
  params: Promise<{ teamId: string }>;
};

const GET = async (_request: Request, { params }: Params) => {
  const { teamId } = await params;
  const team = await getTeam(teamId);

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  return NextResponse.json(team);
};

export { GET };
