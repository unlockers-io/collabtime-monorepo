import { Skeleton } from "@repo/ui/components/skeleton";

import {
  SectionCard,
  SectionCardContent,
  SectionCardFooter,
  SectionCardHeader,
} from "@/components/section-card";

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
    <div className="flex flex-col gap-2">
      <Skeleton className="h-7 w-80 max-w-full rounded-none" />
      <Skeleton className="h-4 w-96 max-w-full rounded-none" />
    </div>
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

    <div className="flex flex-col">
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

    <div className="flex flex-wrap gap-4">
      <Skeleton className="h-3 w-20 rounded-none" />
      <Skeleton className="h-3 w-24 rounded-none" />
      <Skeleton className="h-3 w-16 rounded-none" />
    </div>
  </div>
);

const RosterRowSkeleton = ({ group = false }: { group?: boolean }) => (
  <div className="flex items-center gap-3 py-2.5">
    {!group && <Skeleton className="size-8 shrink-0 rounded-none" />}
    <div className="flex flex-1 flex-col gap-1.5">
      <Skeleton className={`h-4 rounded-none ${group ? "w-24" : "w-32"}`} />
      <Skeleton className="h-3 w-44 max-w-full rounded-none" />
    </div>
    {!group && <Skeleton className="h-8 w-28 shrink-0 rounded-none" />}
  </div>
);

const Loading = () => {
  return (
    <div aria-busy="true" className="min-h-dvh w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <main className="mx-auto flex w-full max-w-450 flex-col gap-10" id="main">
        <header className="flex flex-col gap-6">
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

        <SectionCard>
          <SectionCardHeader>
            <SectionHeadingSkeleton description />
          </SectionCardHeader>
          <SectionCardContent>
            <TimelineSkeleton />
          </SectionCardContent>
        </SectionCard>

        <SectionCard>
          <SectionCardHeader>
            <SectionHeadingSkeleton />
          </SectionCardHeader>
          <SectionCardContent className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {STATUS_GROUPS.map((group) => (
              <div className="flex flex-col gap-2" key={group}>
                <Skeleton className="h-3 w-24 rounded-none" />
                <div className="flex flex-col gap-2 border-t border-border pt-2">
                  <Skeleton className="h-4 w-full rounded-none" />
                  <Skeleton className="h-4 w-3/4 rounded-none" />
                </div>
              </div>
            ))}
          </SectionCardContent>
        </SectionCard>

        <div className="grid grid-cols-1 items-start gap-10 xl:grid-cols-team [&>*]:min-w-0">
          <SectionCard>
            <SectionCardHeader>
              <SectionHeadingSkeleton />
              <Skeleton className="h-5 w-7 rounded-full" />
            </SectionCardHeader>
            <SectionCardContent className="flex flex-col divide-y divide-border border-y border-border">
              {["member-1", "member-2", "member-3"].map((member) => (
                <RosterRowSkeleton key={member} />
              ))}
            </SectionCardContent>
            <SectionCardFooter className="justify-end">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-36" />
            </SectionCardFooter>
          </SectionCard>

          <SectionCard>
            <SectionCardHeader>
              <SectionHeadingSkeleton />
              <Skeleton className="h-5 w-7 rounded-full" />
            </SectionCardHeader>
            <SectionCardContent className="flex flex-col divide-y divide-border border-y border-border">
              {["group-1", "group-2"].map((group) => (
                <RosterRowSkeleton group key={group} />
              ))}
            </SectionCardContent>
            <SectionCardFooter className="justify-end">
              <Skeleton className="h-8 w-24" />
            </SectionCardFooter>
          </SectionCard>
        </div>
      </main>
    </div>
  );
};

export default Loading;
