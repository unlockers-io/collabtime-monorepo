import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTeamName, validateTeam } from "@/lib/actions";
import { readTeamSession } from "@/lib/team-session";
import { TeamPageClient } from "./client";

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
};

export const generateMetadata = async ({
  params,
}: TeamPageProps): Promise<Metadata> => {
  const { teamId } = await params;

  const exists = await validateTeam(teamId);

  if (!exists) {
    notFound();
  }

  const teamName = await getTeamName(teamId);

  return {
    title: `${teamName}`,
    description: `Working hours and overlap view for ${teamName}.`,
  };
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
