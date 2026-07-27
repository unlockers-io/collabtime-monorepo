"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import dynamic from "next/dynamic";
import { useState } from "react";

import { DEMO_GROUPS, DEMO_MEMBERS } from "./demo-team";

const SECTION_ROW_COUNTS = [2, 3];

// Mirrors the real visualizer: time axis, then one group header per section with
// h-8 rows below it, then the compare button and legend. Row heights and gaps
// match so nothing shifts when the chunk lands.
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

// ssr: false because the visualizer already returns null until it can read the
// viewer's timezone on the client. Rendering it on the server buys nothing and
// risks a hydration mismatch.
const TimezoneVisualizer = dynamic(
  async () => {
    const visualizerModule = await import("@/components/timezone-visualizer");
    return visualizerModule.TimezoneVisualizer;
  },
  { loading: () => <PreviewSkeleton />, ssr: false },
);

const ProductPreview = () => {
  // The visualizer renders group headers as aria-expanded buttons regardless, so
  // the demo owns the collapse state rather than shipping dead controls.
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Array<string>>([]);

  const handleToggleGroupCollapse = (groupId: string) => {
    setCollapsedGroupIds((previous) =>
      previous.includes(groupId) ? previous.filter((id) => id !== groupId) : [...previous, groupId],
    );
  };

  return (
    <div className="rounded-(--frame-radius) bg-secondary/40 p-(--frame-padding) outline-1 -outline-offset-1 outline-black/5 [--frame-padding:--spacing(2)] [--frame-radius:var(--radius-xl)] dark:outline-white/10">
      <div className="flex flex-col gap-4 rounded-[calc(var(--frame-radius)-var(--frame-padding))] bg-background p-4 sm:p-6">
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
