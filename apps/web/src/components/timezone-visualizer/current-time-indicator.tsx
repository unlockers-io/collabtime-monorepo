"use client";

type CurrentTimeIndicatorProps = {
  nowPosition: number | null;
};

const CurrentTimeIndicator = ({ nowPosition }: CurrentTimeIndicatorProps) => {
  if (nowPosition === null) {
    return null;
  }

  return (
    <>
      <div
        className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 rounded-full bg-destructive shadow-sm sm:hidden"
        style={{
          left: `calc(2.5rem + (100% - 2.5rem) * ${nowPosition / 100})`,
        }}
      >
        <div className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-destructive" />
      </div>
      {/* Desktop */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 z-20 hidden w-0.5 rounded-full bg-destructive shadow-sm sm:block"
        style={{
          left: `calc(6.75rem + (100% - 6.75rem) * ${nowPosition / 100})`,
        }}
      >
        <div className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-destructive" />
      </div>
    </>
  );
};

export { CurrentTimeIndicator };
