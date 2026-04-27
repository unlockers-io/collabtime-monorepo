"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";

import { formatHour } from "@/lib/utils";
import type { TeamMember } from "@/types";

import {
  HOURS_IN_DAY,
  getOverlapColorClass,
  getOverlapLabel,
  getRoundedCornerClass,
} from "./helpers";
import type { MemberRow, OverlapData } from "./types";

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
  const { crossTeamOverlapHours, overlapCounts, overlapHours, partialOverlapHours } = overlapData;

  return (
    <div className="flex h-8 gap-px overflow-hidden rounded-lg bg-secondary p-1">
      {Array.from({ length: HOURS_IN_DAY }, (_, hour) => {
        const isFullOverlap = overlapHours[hour];
        const isCrossTeamOverlap = crossTeamOverlapHours[hour];
        const isPartialOverlap = partialOverlapHours[hour];
        const hasAnyOverlap = isFullOverlap || isPartialOverlap || isCrossTeamOverlap;

        const colorClass = getOverlapColorClass(
          isFullOverlap,
          isCrossTeamOverlap,
          isPartialOverlap,
        );

        if (!hasAnyOverlap) {
          return (
            <Tooltip key={hour}>
              <TooltipTrigger
                render={<div className={`h-6 flex-1 bg-muted ${getRoundedCornerClass(hour)}`} />}
              />
              <TooltipContent side="top">
                <div className="font-medium tabular-nums">
                  {formatHour(hour)} – {formatHour((hour + 1) % HOURS_IN_DAY)}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        }

        const overlapLabel = getOverlapLabel(
          isFullOverlap,
          isCrossTeamOverlap,
          totalPeopleSelected,
          overlapCounts[hour] ?? 0,
        );

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
            const key = member.groupId
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

        // Identify teams where no one is available (entire team unavailable)
        const fullyUnavailableTeams = [...unavailableByTeam.keys()].filter(
          (teamName) => !availableByTeam.has(teamName),
        );
        // Teams with some members available and some unavailable
        const partiallyUnavailableTeams = [...unavailableByTeam.entries()].filter(([teamName]) =>
          availableByTeam.has(teamName),
        );

        return (
          <Tooltip key={hour}>
            <TooltipTrigger
              render={<div className={`h-6 flex-1 ${getRoundedCornerClass(hour)} ${colorClass}`} />}
            />
            <TooltipContent side="top">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <div className="font-medium text-foreground tabular-nums">
                    {formatHour(hour)} – {formatHour((hour + 1) % HOURS_IN_DAY)}
                  </div>
                  <div className="text-xs text-muted-foreground">{overlapLabel}</div>
                </div>
                {availableByTeam.size > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-medium tracking-wide text-success uppercase">
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
                    <span className="text-[10px] font-medium tracking-wide text-destructive uppercase">
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
                    {/* Teams with some members unavailable */}
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
