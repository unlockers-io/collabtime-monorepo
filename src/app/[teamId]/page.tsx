import { notFound } from "next/navigation";
import { validateTeam } from "@/lib/actions";
import { readTeamSession } from "@/lib/team-session";
import { TeamPageClient } from "./client";

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
};

const TeamPage = async ({ params }: TeamPageProps) => {
  const { teamId } = await params;
  const exists = await validateTeam(teamId);
  if (!exists) {
    notFound();
  }

  const initialToken = await readTeamSession(teamId);

  return <TeamPageClient teamId={teamId} initialToken={initialToken} />;
};

export default TeamPage;
