"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from "@repo/ui/components/select";
import { Clock, Plus, Users, X } from "lucide-react";

import { formatHour } from "@/lib/utils";
import type { TeamGroup, TeamMember } from "@/types";

import {
  HOURS_IN_DAY,
  TIME_AXIS_HOURS,
  deserializeSelection,
  getEdgeAlignment,
  serializeSelection,
} from "./helpers";
import { OverlapBar } from "./overlap-bar";
import { OverlapStatusIcon } from "./subcomponents";
import type { MemberRow, OverlapData, OverlapStatus, Selection } from "./types";

type ComparePanelProps = {
  canShowOverlap: boolean;
  groupNameById: Map<string, string>;
  groups: Array<TeamGroup>;
  memberRowById: Map<string, MemberRow>;
  members: Array<TeamMember>;
  onAddSelection: (sel: Selection) => void;
  onClose: () => void;
  onRemoveSelection: (sel: Selection) => void;
  overlapData: OverlapData;
  overlapStatus: OverlapStatus;
  selectedMemberIds: Set<string>;
  totalPeopleSelected: number;
  validSelections: Array<Selection>;
};

const ComparePanel = ({
  canShowOverlap,
  groupNameById,
  groups,
  memberRowById,
  members,
  onAddSelection,
  onClose,
  onRemoveSelection,
  overlapData,
  overlapStatus,
  selectedMemberIds,
  totalPeopleSelected,
  validSelections,
}: ComparePanelProps) => {
  const { overlapHours, partialOverlapHours } = overlapData;

  const getSelectionName = (sel: Selection): string => {
    if (sel.type === "member") {
      return members.find((m) => m.id === sel.id)?.name ?? "Unknown";
    }
    return groups.find((g) => g.id === sel.id)?.name ?? "Unknown";
  };

  const isSelectionSelected = (sel: Selection): boolean => {
    const key = serializeSelection(sel);
    return validSelections.some((s) => serializeSelection(s) === key);
  };

  const renderOverlapSummary = () => {
    const anyOverlap = overlapHours.map((full, i) => full || partialOverlapHours[i]);
    const start = anyOverlap.findIndex(Boolean);
    const end = anyOverlap.lastIndexOf(true);

    if (start === -1 || end === -1) {
      return null;
    }

    const fullHoursCount = overlapHours.filter(Boolean).length;
    const partialHoursCount = partialOverlapHours.filter(Boolean).length;
    const endExclusive = end + 1;

    return (
      <span>
        {formatHour(start)} – {formatHour(endExclusive % HOURS_IN_DAY)}
        <span className="ml-1">
          ({fullHoursCount}h full
          {partialHoursCount > 0 ? `, ${partialHoursCount}h partial` : ""})
        </span>
      </span>
    );
  };

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Clock className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Find Best Meeting Time</h3>
            <p className="text-xs text-muted-foreground">Select people or groups to compare</p>
          </div>
        </div>
        <Button
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          size="sm"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {validSelections.map((sel) => (
          <Badge
            className="flex items-center gap-1.5 py-1 pr-1 pl-2"
            key={serializeSelection(sel)}
            variant="secondary"
          >
            {sel.type === "group" && <Users className="h-3 w-3" />}
            <span>{getSelectionName(sel)}</span>
            <button
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
              onClick={() => onRemoveSelection(sel)}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <Select
          onValueChange={(val) => {
            if (val === null) {
              return;
            }
            const sel = deserializeSelection(val);
            if (sel) {
              onAddSelection(sel);
            }
          }}
          value=""
        >
          {validSelections.length === 0 ? (
            <SelectTrigger className="h-8 w-auto gap-1.5 border-dashed px-3 [&>svg:last-child]:hidden">
              <Plus className="h-4 w-4" />
              <span className="text-sm">Add</span>
            </SelectTrigger>
          ) : (
            <SelectTrigger className="h-7 w-7 justify-center rounded-full border-dashed p-0 [&>svg:last-child]:hidden">
              <Plus className="h-4 w-4" />
            </SelectTrigger>
          )}
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Members</SelectLabel>
              {members.map((member) => {
                const sel: Selection = {
                  id: member.id,
                  type: "member",
                };
                const isAlreadySelected = isSelectionSelected(sel);

                return (
                  <SelectItem
                    disabled={isAlreadySelected}
                    key={`member:${member.id}`}
                    value={serializeSelection(sel)}
                  >
                    {member.name}
                  </SelectItem>
                );
              })}
            </SelectGroup>
            {groups.some((g) => members.some((m) => m.groupId === g.id)) && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Groups</SelectLabel>
                  {groups
                    .filter((g) => members.some((m) => m.groupId === g.id))
                    .map((group) => {
                      const sel: Selection = {
                        id: group.id,
                        type: "group",
                      };
                      const isAlreadySelected = isSelectionSelected(sel);

                      return (
                        <SelectItem
                          disabled={isAlreadySelected}
                          key={`group:${group.id}`}
                          value={serializeSelection(sel)}
                        >
                          <span className="flex items-center gap-2">
                            <Users className="h-3 w-3" />
                            {group.name}
                          </span>
                        </SelectItem>
                      );
                    })}
                </SelectGroup>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {canShowOverlap && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <p className="text-right text-xs text-muted-foreground tabular-nums">
            {renderOverlapSummary()}
          </p>

          <div className="flex items-stretch gap-2 sm:gap-3">
            <div className="flex w-8 shrink-0 flex-col sm:w-24">
              <div className="flex h-8 items-center justify-center sm:justify-start sm:gap-2">
                <OverlapStatusIcon status={overlapStatus} />
                <span className="hidden truncate text-sm font-medium text-foreground sm:block">
                  {overlapStatus === "none" ? "No overlap" : "Overlap"}
                </span>
              </div>
            </div>

            <div className="flex-1">
              <OverlapBar
                groupNameById={groupNameById}
                memberRowById={memberRowById}
                overlapData={overlapData}
                selectedMemberIds={selectedMemberIds}
                totalPeopleSelected={totalPeopleSelected}
              />
            </div>
          </div>

          {/* Time axis for overlap visualization */}
          <div className="flex gap-2 sm:gap-3">
            <div className="w-8 shrink-0 sm:w-24" />
            <div className="flex flex-1 justify-between">
              {TIME_AXIS_HOURS.map((hour, index, arr) => {
                const isFirst = index === 0;
                const isLast = index === arr.length - 1;

                return (
                  <div
                    className="flex flex-col gap-1"
                    key={hour}
                    style={{
                      alignItems: getEdgeAlignment(isFirst, isLast),
                    }}
                  >
                    <div className="h-1.5 w-px bg-border" />
                    <span className="text-[10px] whitespace-nowrap text-muted-foreground tabular-nums sm:text-xs">
                      {formatHour(hour % HOURS_IN_DAY)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!canShowOverlap && (
        <p className="text-center text-sm text-muted-foreground">
          Select at least 2 people to find overlapping times
        </p>
      )}
    </Card>
  );
};

export { ComparePanel };
