"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import dynamic from "next/dynamic";
import { useState } from "react";

import { DEMO_GROUPS, DEMO_MEMBERS } from "./demo-team";

const SECTION_ROW_COUNTS = [2, 3];

const PreviewSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-6">
    <div className="flex gap-2 sm:gap-3">
      <div className="w-8 shrink-0 sm:w-24" />
      <Skeleton className="h-5 flex-1" />
    </div>

    {SECTION_ROW_COUNTS.map((rowCount, sectionIndex) => (
      <div className="flex flex-col gap-3" key={sectionIndex}>
        <Skeleton className="h-4 w-28" />
        <div className="flex items-stretch gap-2 sm:gap-3">
          <div className="flex w-8 shrink-0 flex-col gap-3 sm:w-24">
            {Array.from({ length: rowCount }, (_, rowIndex) => (
              <Skeleton className="h-8" key={rowIndex} />
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-3">
            {Array.from({ length: rowCount }, (_, rowIndex) => (
              <Skeleton className="h-8 rounded-lg" key={rowIndex} />
            ))}
          </div>
        </div>
      </div>
    ))}

    <Skeleton className="h-14 w-full rounded-lg" />
    <Skeleton className="mx-auto h-4 w-48" />
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
    <div className="rounded-xl bg-primary/15 p-2 outline-1 -outline-offset-1 outline-primary/35">
      <div className="flex flex-col gap-4 rounded-lg bg-background p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Sample team</p>
          <p className="text-sm text-muted-foreground">
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
