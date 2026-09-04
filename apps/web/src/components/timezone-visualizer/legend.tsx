"use client";

type LegendProps = {
  canShowOverlap: boolean;
  hasCrossTeamOverlap: boolean;
  isComparing: boolean;
  showsSharedWindow: boolean;
  totalPeopleSelected: number;
};

const Legend = ({
  canShowOverlap,
  hasCrossTeamOverlap,
  isComparing,
  showsSharedWindow,
  totalPeopleSelected,
}: LegendProps) => (
  <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
    <div className="flex items-center gap-1.5">
      <div className="size-3 bg-foreground/55" />
      <span>Working hours</span>
    </div>
    {!isComparing && showsSharedWindow && (
      <div className="flex items-center gap-1.5">
        <div className="size-3 bg-foreground" />
        <span>Best shared window</span>
      </div>
    )}
    {isComparing && canShowOverlap && (
      <>
        <div className="flex items-center gap-1.5">
          <div className="size-3 bg-success" />
          <span>Full overlap</span>
        </div>
        {hasCrossTeamOverlap && (
          <div className="flex items-center gap-1.5">
            <div className="size-3 bg-info" />
            <span>Each team represented</span>
          </div>
        )}
        {totalPeopleSelected >= 3 && (
          <div className="flex items-center gap-1.5">
            <div className="size-3 bg-warning" />
            <span>Partial overlap</span>
          </div>
        )}
      </>
    )}
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        <div className="h-3 w-px bg-foreground" />
      </div>
      <span>Current time</span>
    </div>
  </div>
);

export { Legend };
