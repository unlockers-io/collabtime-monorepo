import { notFound } from "next/navigation";
import { getTeam } from "@/lib/actions";
import { TeamPageClient } from "./client";

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
};

const TeamPage = async ({ params }: TeamPageProps) => {
  const { teamId } = await params;
  const team = await getTeam(teamId);

  if (!team) {
    notFound();
  }

  return <TeamPageClient team={team} />;
};

export default TeamPage;
