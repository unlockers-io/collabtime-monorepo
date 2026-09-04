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
        className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-foreground sm:hidden"
        style={{
          left: `calc(7.5rem + (100% - 7.5rem) * ${nowPosition / 100})`,
        }}
      />
      {/* Desktop */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 z-20 hidden w-px bg-foreground sm:block"
        style={{
          left: `calc(10.75rem + (100% - 10.75rem) * ${nowPosition / 100})`,
        }}
      />
    </>
  );
};

export { CurrentTimeIndicator };
