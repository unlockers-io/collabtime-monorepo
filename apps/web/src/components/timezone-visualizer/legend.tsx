"use client";

type LegendProps = {
  canShowOverlap: boolean;
  hasCrossTeamOverlap: boolean;
  isComparing: boolean;
  totalPeopleSelected: number;
};

const Legend = ({
  canShowOverlap,
  hasCrossTeamOverlap,
  isComparing,
  totalPeopleSelected,
}: LegendProps) => (
  <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
    <div className="flex items-center gap-1.5">
      <div className="h-3 w-3 rounded bg-foreground/80 dark:bg-accent-foreground" />
      <span>Working hours</span>
    </div>
    {isComparing && canShowOverlap && (
      <>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-success" />
          <span>Full overlap</span>
        </div>
        {hasCrossTeamOverlap && (
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-info" />
            <span>Each team represented</span>
          </div>
        )}
        {totalPeopleSelected >= 3 && (
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-warning" />
            <span>Partial overlap</span>
          </div>
        )}
      </>
    )}
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        <div className="h-3 w-0.5 rounded-full bg-destructive" />
        <div className="-ml-px h-1.5 w-1.5 rounded-full bg-destructive" />
      </div>
      <span>Current time</span>
    </div>
  </div>
);

export { Legend };
