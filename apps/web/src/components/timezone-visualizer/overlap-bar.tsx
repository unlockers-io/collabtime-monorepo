"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";

import { formatHour } from "@/lib/utils";
import type { TeamMember } from "@/types";

import { HOURS_IN_DAY, getOverlapColorClass, getOverlapLabel, hasAnyOverlap } from "./helpers";
import type { HourOverlap, MemberRow, OverlapData } from "./types";

const NO_OVERLAP: HourOverlap = {
  availableCount: 0,
  coverage: "none",
  isEveryTeamRepresented: false,
};

type OverlapBarProps = {
  groupNameById: Map<string, string>;
  memberRowById: Map<string, MemberRow>;
  overlapData: OverlapData;
  selectedMemberIds: Set<string>;
  totalPeopleSelected: number;
};

const OverlapBar = ({
  groupNameById,
  memberRowById,
  overlapData,
  selectedMemberIds,
  totalPeopleSelected,
}: OverlapBarProps) => {
  return (
    <div className="flex h-8 gap-px overflow-hidden bg-transparent">
      {Array.from({ length: HOURS_IN_DAY }, (_, hour) => {
        const hourOverlap = overlapData.hours[hour] ?? NO_OVERLAP;
        const isFullOverlap = hourOverlap.coverage === "full";
        const colorClass = getOverlapColorClass(hourOverlap);

        if (!hasAnyOverlap(hourOverlap)) {
          return (
            <Tooltip key={hour}>
              <TooltipTrigger render={<div className="h-8 flex-1 bg-muted/50" />} />
              <TooltipContent side="top">
                <div className="font-mono font-medium tabular-nums">
                  {formatHour(hour)} – {formatHour((hour + 1) % HOURS_IN_DAY)}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        }

        const overlapLabel = getOverlapLabel(hourOverlap, totalPeopleSelected);

        const allAvailable: Array<TeamMember> = [];
        const allUnavailable: Array<TeamMember> = [];
        for (const memberId of selectedMemberIds) {
          const row = memberRowById.get(memberId);
          if (!row) {
            continue;
          }
          if (row.hours[hour]) {
            allAvailable.push(row.member);
          } else {
            allUnavailable.push(row.member);
          }
        }

        const bucketByTeam = (list: Array<TeamMember>) => {
          const buckets = new Map<string, Array<string>>();
          for (const member of list) {
            const key =
              member.groupId !== undefined && member.groupId !== ""
                ? (groupNameById.get(member.groupId) ?? "Team")
                : "Ungrouped";
            const names = buckets.get(key) ?? [];
            names.push(member.name);
            buckets.set(key, names);
          }
          return buckets;
        };

        const availableByTeam = bucketByTeam(allAvailable);
        const unavailableByTeam = bucketByTeam(allUnavailable);

        const fullyUnavailableTeams = [...unavailableByTeam.keys()].filter(
          (teamName) => !availableByTeam.has(teamName),
        );
        const partiallyUnavailableTeams = [...unavailableByTeam.entries()].filter(([teamName]) =>
          availableByTeam.has(teamName),
        );

        return (
          <Tooltip key={hour}>
            <TooltipTrigger render={<div className={`h-8 flex-1 ${colorClass}`} />} />
            <TooltipContent side="top">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <div className="font-mono font-medium text-foreground tabular-nums">
                    {formatHour(hour)} – {formatHour((hour + 1) % HOURS_IN_DAY)}
                  </div>
                  <div className="text-xs text-muted-foreground">{overlapLabel}</div>
                </div>
                {availableByTeam.size > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[0.625rem] font-medium tracking-wide text-success uppercase">
                      Available by team
                    </span>
                    {[...availableByTeam.entries()].map(([teamName, names]) => (
                      <div
                        className="flex items-center justify-between gap-4 text-xs"
                        key={`${teamName}-available`}
                      >
                        <span className="truncate font-medium text-foreground">{teamName}</span>
                        <span className="truncate text-success">{names.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!isFullOverlap && unavailableByTeam.size > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[0.625rem] font-medium tracking-wide text-destructive uppercase">
                      Unavailable
                    </span>
                    {/* Teams with no one available - shown with strikethrough */}
                    {fullyUnavailableTeams.map((teamName) => (
                      <div
                        className="flex items-center justify-between gap-4 text-xs text-muted-foreground opacity-60"
                        key={`${teamName}-fully-unavailable`}
                      >
                        <span className="truncate font-medium line-through">{teamName}</span>
                        <span className="truncate">
                          {unavailableByTeam.get(teamName)?.join(", ")}
                        </span>
                      </div>
                    ))}
                    {partiallyUnavailableTeams.map(([teamName, names]) => (
                      <div
                        className="flex items-center justify-between gap-4 text-xs text-muted-foreground"
                        key={`${teamName}-unavailable`}
                      >
                        <span className="truncate font-medium text-foreground">{teamName}</span>
                        <span className="truncate">{names.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

export { OverlapBar };
