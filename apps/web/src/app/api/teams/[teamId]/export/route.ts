import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth-server";
import { prisma, SubscriptionPlan } from "@repo/db";
import { getTeamRecord, sanitizeTeam } from "@/lib/actions-internal";

type Params = {
  params: Promise<{ teamId: string }>;
};

// GET /api/teams/[teamId]/export - Export team data as CSV
export const GET = async (request: Request, { params }: Params) => {
  try {
    const { teamId } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "csv";

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user owns this team's space and is PRO
    const space = await prisma.space.findUnique({
      where: { teamId },
    });

    if (!space || space.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (user?.subscriptionPlan !== SubscriptionPlan.PRO) {
      return NextResponse.json(
        { error: "Export requires PRO subscription" },
        { status: 402 }
      );
    }

    // Get team data
    const team = await getTeamRecord(teamId);
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const sanitizedTeam = sanitizeTeam(team);

    if (format === "json") {
      return NextResponse.json(sanitizedTeam, {
        headers: {
          "Content-Disposition": `attachment; filename="team-${teamId}.json"`,
        },
      });
    }

    // Generate CSV
    const csvRows = [
      ["Name", "Title", "Timezone", "Working Hours Start", "Working Hours End", "Group"].join(","),
      ...sanitizedTeam.members.map((member) => {
        const group = sanitizedTeam.groups.find((g) => g.id === member.groupId);
        return [
          escapeCSV(member.name),
          escapeCSV(member.title ?? ""),
          member.timezone,
          `${member.workingHoursStart}:00`,
          `${member.workingHoursEnd}:00`,
          escapeCSV(group?.name ?? ""),
        ].join(",");
      }),
    ];

    const csv = csvRows.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="team-${sanitizedTeam.name || teamId}.csv"`,
      },
    });
  } catch (error) {
    console.error("[Teams Export API] Error exporting team:", error);
    return NextResponse.json(
      { error: "Failed to export team" },
      { status: 500 }
    );
  }
};

const escapeCSV = (value: string): string => {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};
