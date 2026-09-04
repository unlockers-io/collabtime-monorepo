import { Skeleton } from "@repo/ui/components/skeleton";

const STATUS_GROUPS = ["online", "starting", "wrapping"];
const TIMELINE_HOURS = Array.from({ length: 12 }, (_, index) => `hour-${index}`);
const TIMELINE_SECTIONS = [
  { id: "design", rows: 2 },
  { id: "engineering", rows: 3 },
];

const SectionHeadingSkeleton = ({ description = false }: { description?: boolean }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <div className="flex items-center gap-2">
      <Skeleton className="size-4 rounded-none" />
      <Skeleton className="h-3.5 w-28 rounded-none" />
    </div>
    {description && <Skeleton className="h-3 w-44 rounded-none" />}
  </div>
);

const TimelineSkeleton = () => (
  <div className="flex flex-col gap-6">
    <div className="flex gap-2 sm:gap-3">
      <div className="w-28 shrink-0 sm:w-40" />
      <div className="flex flex-1 justify-between">
        {["midnight", "morning", "noon", "evening", "night"].map((tick) => (
          <div className="flex flex-col items-center gap-1" key={tick}>
            <Skeleton className="h-3 w-6 rounded-none sm:w-8" />
            <div className="h-1.5 w-px bg-border" />
          </div>
        ))}
      </div>
    </div>

    <div className="flex max-h-80 flex-col">
      {TIMELINE_SECTIONS.map((section, sectionIndex) => (
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
              {Array.from({ length: section.rows }, (_, rowIndex) => (
                <div className="flex h-8 items-center gap-2" key={rowIndex}>
                  <Skeleton className="size-6 shrink-0 rounded-none sm:size-7" />
                  <Skeleton className="h-3.5 w-14 rounded-none sm:w-20" />
                </div>
              ))}
            </div>
            <div className="flex flex-1 flex-col gap-3">
              {Array.from({ length: section.rows }, (_, rowIndex) => (
                <div className="grid h-8 grid-cols-12 gap-px" key={rowIndex}>
                  {TIMELINE_HOURS.map((hour, hourIndex) => (
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
    </div>

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

const RosterRowSkeleton = ({ group = false }: { group?: boolean }) => (
  <div className="flex min-h-35 flex-col gap-3 border-b border-border py-4">
    <div className="flex items-start justify-between">
      <Skeleton className="size-10 rounded-none" />
      <Skeleton className="size-8" />
    </div>
    <div className="flex flex-1 flex-col gap-2">
      <Skeleton className={`h-4 rounded-none ${group ? "w-24" : "w-32"}`} />
      {!group && (
        <>
          <Skeleton className="h-3 w-20 rounded-none" />
          <Skeleton className="mt-auto h-3 w-36 rounded-none" />
        </>
      )}
      <Skeleton className="h-5 w-24 rounded-full" />
    </div>
  </div>
);

const Loading = () => {
  return (
    <div aria-busy="true" className="min-h-dvh w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <main className="mx-auto flex w-full max-w-450 flex-col gap-10" id="main">
        <header className="flex flex-col gap-6 border-b border-border pb-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-3.5 rounded-none" />
              <Skeleton className="h-5 w-24 rounded-none" />
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="size-9" />
              <Skeleton className="size-9" />
              <Skeleton className="size-9" />
            </div>
            <Skeleton className="size-9 sm:hidden" />
          </div>
          <Skeleton className="h-10 w-64 max-w-full rounded-none sm:h-15 sm:w-96" />
        </header>

        <section className="flex flex-col gap-5 border-y border-border py-5 sm:py-6">
          <div className="border-b border-border pb-4 sm:pb-5">
            <SectionHeadingSkeleton description />
          </div>
          <TimelineSkeleton />
        </section>

        <section className="flex flex-col gap-5 border-y border-border py-5 sm:py-6">
          <SectionHeadingSkeleton />
          <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {STATUS_GROUPS.map((group, index) => (
              <div
                className={`flex flex-col gap-2.5 border-t border-border py-3.5 ${
                  index === 2 ? "sm:col-span-2 lg:col-span-1" : ""
                }`}
                key={group}
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded-none" />
                  <Skeleton className="h-3 w-20 rounded-none" />
                  <Skeleton className="ml-auto h-5 w-7 rounded-full" />
                </div>
                <div className="flex flex-wrap gap-1.5 px-1 py-0.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-10 xl:grid-cols-[1.4fr_0.6fr] [&>*]:min-w-0">
          <section className="flex flex-col gap-5 border-y border-border py-5 sm:py-6">
            <div className="flex items-start justify-between gap-3">
              <SectionHeadingSkeleton />
              <Skeleton className="h-5 w-7 rounded-full" />
            </div>
            <div className="grid grid-cols-1 pr-4">
              {["member-1", "member-2", "member-3"].map((member) => (
                <RosterRowSkeleton key={member} />
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4 sm:pt-5">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-36" />
            </div>
          </section>

          <section className="flex flex-col gap-5 border-y border-border py-5 sm:py-6">
            <div className="flex items-start justify-between gap-3">
              <SectionHeadingSkeleton />
              <Skeleton className="h-5 w-7 rounded-full" />
            </div>
            <div className="grid grid-cols-1 pr-4">
              {["group-1", "group-2"].map((group) => (
                <RosterRowSkeleton group key={group} />
              ))}
            </div>
            <div className="flex items-center justify-end border-t border-border pt-4 sm:pt-5">
              <Skeleton className="h-8 w-24" />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Loading;
