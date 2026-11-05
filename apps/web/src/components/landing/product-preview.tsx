"use client";

import { useState } from "react";

import { TimezoneVisualizer } from "@/components/timezone-visualizer";

import { DEMO_GROUPS, DEMO_MEMBERS } from "./demo-team";

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
          <p className="font-display text-xs font-semibold tracking-caps text-foreground uppercase">
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
