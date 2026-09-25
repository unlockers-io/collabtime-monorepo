"use client";

type LegendProps = {
  hasExcluded: boolean;
  showsSharedWindow: boolean;
};

const Legend = ({ hasExcluded, showsSharedWindow }: LegendProps) => (
  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
    <div className="flex items-center gap-1.5">
      <div className="size-3 bg-foreground/55" />
      <span>Working hours</span>
    </div>
    {showsSharedWindow && (
      <div className="flex items-center gap-1.5">
        <div className="size-3 bg-foreground" />
        <span>Best window</span>
      </div>
    )}
    {hasExcluded && (
      <div className="flex items-center gap-1.5">
        <div className="size-3 bg-foreground/25" />
        <span>Not counted</span>
      </div>
    )}
    <div className="flex items-center gap-1.5">
      <div className="h-3 w-px bg-foreground" />
      <span>Now</span>
    </div>
  </div>
);

export { Legend };
