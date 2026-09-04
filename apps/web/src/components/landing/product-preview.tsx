"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import dynamic from "next/dynamic";
import { useState } from "react";

import { DEMO_GROUPS, DEMO_MEMBERS } from "./demo-team";

const PREVIEW_HOURS = Array.from({ length: 12 }, (_, index) => `preview-hour-${index}`);
const PREVIEW_SECTIONS = [
  { id: "design", rows: ["design-1", "design-2"] },
  { id: "engineering", rows: ["engineering-1", "engineering-2", "engineering-3"] },
];
const PREVIEW_TICKS = ["midnight", "morning", "noon", "evening", "night"];

const PreviewSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-6">
    <div className="flex gap-2 sm:gap-3">
      <div className="w-28 shrink-0 sm:w-40" />
      <div className="flex flex-1 justify-between">
        {PREVIEW_TICKS.map((tick) => (
          <div className="flex flex-col items-center gap-1" key={tick}>
            <Skeleton className="h-3 w-6 rounded-none sm:w-8" />
            <div className="h-1.5 w-px bg-border" />
          </div>
        ))}
      </div>
    </div>

    {PREVIEW_SECTIONS.map((section, sectionIndex) => (
      <div
        className="flex flex-col gap-3 border-b border-border/50 py-4 first:pt-0 last:border-b-0 last:pb-0"
        key={section.id}
      >
        <div className="flex items-center gap-2 py-1">
          <Skeleton className="size-3 rounded-none" />
          <Skeleton className={`h-3 rounded-none ${sectionIndex === 0 ? "w-20" : "w-28"}`} />
          <Skeleton className="h-3 w-4 rounded-none" />
        </div>
        <div className="flex items-stretch gap-2 sm:gap-3">
          <div className="flex w-28 shrink-0 flex-col gap-3 sm:w-40">
            {section.rows.map((row) => (
              <div className="flex h-8 items-center gap-2" key={row}>
                <Skeleton className="size-6 shrink-0 rounded-none sm:size-7" />
                <Skeleton className="h-3.5 w-14 rounded-none sm:w-20" />
              </div>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-3">
            {section.rows.map((row, rowIndex) => (
              <div className="grid h-8 grid-cols-12 gap-px" key={row}>
                {PREVIEW_HOURS.map((hour, hourIndex) => (
                  <Skeleton
                    className={`h-full rounded-none ${
                      (hourIndex + rowIndex + sectionIndex) % 4 === 0
                        ? "bg-muted-foreground/25"
                        : "bg-muted/70"
                    }`}
                    key={hour}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    ))}

    <div className="flex h-14 items-center justify-center border-y border-dashed border-border">
      <Skeleton className="h-4 w-44 rounded-none" />
    </div>
    <div className="flex flex-wrap justify-center gap-4">
      <Skeleton className="h-3 w-20 rounded-none" />
      <Skeleton className="h-3 w-24 rounded-none" />
      <Skeleton className="h-3 w-16 rounded-none" />
    </div>
  </div>
);

const TimezoneVisualizer = dynamic(
  async () => {
    const visualizerModule = await import("@/components/timezone-visualizer");
    return visualizerModule.TimezoneVisualizer;
  },
  { loading: () => <PreviewSkeleton />, ssr: false },
);

const ProductPreview = () => {
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Array<string>>([]);

  const handleToggleGroupCollapse = (groupId: string) => {
    setCollapsedGroupIds((previous) =>
      previous.includes(groupId) ? previous.filter((id) => id !== groupId) : [...previous, groupId],
    );
  };

  return (
    <div className="border-y border-border py-5 sm:py-7">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-xs font-semibold tracking-[0.12em] text-foreground uppercase">
            Sample team · Today
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {DEMO_MEMBERS.length} people, {DEMO_GROUPS.length} groups
          </p>
        </div>
        <TimezoneVisualizer
          collapsedGroupIds={collapsedGroupIds}
          groups={DEMO_GROUPS}
          members={DEMO_MEMBERS}
          onToggleGroupCollapse={handleToggleGroupCollapse}
        />
      </div>
    </div>
  );
};

export { ProductPreview };
