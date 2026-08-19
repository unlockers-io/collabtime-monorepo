const Loading = () => {
  return (
    <div className="min-h-dvh w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <main className="mx-auto flex w-full max-w-450 flex-col gap-6" id="main">
        <header className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="size-9 rounded-lg bg-muted motion-safe:animate-pulse" />
              <div className="h-7 w-40 rounded-lg bg-muted motion-safe:animate-pulse sm:h-8" />
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <div className="h-9 w-36 rounded-lg bg-muted motion-safe:animate-pulse" />
              <div className="h-8 w-24 rounded-md bg-muted motion-safe:animate-pulse" />
              <div className="size-8 rounded-md bg-muted motion-safe:animate-pulse" />
              <div className="size-8 rounded-md bg-muted motion-safe:animate-pulse" />
            </div>
            <div className="flex items-center sm:hidden">
              <div className="size-9 rounded-lg bg-muted motion-safe:animate-pulse" />
            </div>
          </div>
        </header>

        <section className="flex flex-col gap-4 rounded-xl border bg-card py-4 text-card-foreground shadow-sm sm:py-5">
          <div className="flex items-center gap-2 px-4 sm:px-5">
            <div className="size-4 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted motion-safe:animate-pulse" />
          </div>
          <div className="grid gap-3 px-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
            {["insight-1", "insight-2", "insight-3"].map((id) => (
              <div
                className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-secondary/40 p-3.5"
                key={id}
              >
                <div className="flex items-center gap-2">
                  <div className="size-4 rounded bg-muted motion-safe:animate-pulse" />
                  <div className="h-3 w-20 rounded bg-muted motion-safe:animate-pulse" />
                  <div className="ml-auto h-5 w-6 rounded-full bg-muted motion-safe:animate-pulse" />
                </div>
                <div className="flex flex-wrap gap-1.5 px-1 py-0.5">
                  {["chip-a", "chip-b"].map((chipId) => (
                    <div
                      className="h-6 w-16 rounded-full bg-muted motion-safe:animate-pulse"
                      key={chipId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border bg-card py-4 text-card-foreground shadow-sm sm:py-5">
          <div className="flex flex-col gap-0.5 border-b px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="flex items-center gap-2">
              <div className="size-4 rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-4 w-48 rounded bg-muted motion-safe:animate-pulse" />
            </div>
            <div className="h-3 w-36 rounded bg-muted motion-safe:animate-pulse" />
          </div>
          <div className="flex flex-col gap-6 px-4 sm:px-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 shrink-0 sm:w-24" />
              <div className="flex flex-1 justify-between">
                {["tick-1", "tick-2", "tick-3", "tick-4", "tick-5"].map((id) => (
                  <div
                    className="h-3 w-8 rounded bg-muted motion-safe:animate-pulse sm:w-12"
                    key={id}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {["row-1", "row-2", "row-3"].map((id) => (
                <div className="flex items-center gap-2 sm:gap-3" key={id}>
                  <div className="flex w-8 shrink-0 items-center gap-2 sm:w-24">
                    <div className="size-6 rounded-full bg-muted motion-safe:animate-pulse sm:size-7" />
                    <div className="hidden h-4 w-16 rounded bg-muted motion-safe:animate-pulse sm:block" />
                  </div>
                  <div className="h-8 flex-1 rounded-lg bg-muted motion-safe:animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <section className="flex flex-col gap-4 rounded-xl border bg-card py-4 text-card-foreground shadow-sm sm:py-5">
            <div className="flex items-center justify-between px-4 sm:px-5">
              <div className="flex items-center gap-2">
                <div className="size-4 rounded bg-muted motion-safe:animate-pulse" />
                <div className="h-4 w-32 rounded bg-muted motion-safe:animate-pulse" />
              </div>
              <div className="h-5 w-8 rounded-full bg-muted motion-safe:animate-pulse" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4 pr-8 pl-4 sm:pr-9 sm:pl-5">
              {["member-1", "member-2", "member-3", "member-4"].map((id) => (
                <div
                  className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm"
                  key={id}
                >
                  <div className="size-12 rounded-full bg-muted motion-safe:animate-pulse" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="h-5 w-24 rounded bg-muted motion-safe:animate-pulse" />
                    <div className="h-4 w-32 rounded bg-muted motion-safe:animate-pulse" />
                    <div className="mt-auto flex flex-col gap-1">
                      <div className="h-3 w-28 rounded bg-muted motion-safe:animate-pulse" />
                      <div className="h-3 w-20 rounded bg-muted motion-safe:animate-pulse" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <div className="h-6 w-20 rounded-full bg-muted motion-safe:animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 pt-4 sm:px-5 sm:pt-5">
              <div className="h-8 w-32 rounded-md bg-muted motion-safe:animate-pulse" />
              <div className="h-8 w-36 rounded-md bg-muted motion-safe:animate-pulse" />
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-xl border bg-card py-4 text-card-foreground shadow-sm sm:py-5">
            <div className="flex items-center justify-between px-4 sm:px-5">
              <div className="flex items-center gap-2">
                <div className="size-4 rounded bg-muted motion-safe:animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted motion-safe:animate-pulse" />
              </div>
              <div className="h-5 w-8 rounded-full bg-muted motion-safe:animate-pulse" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4 pr-8 pl-4 sm:pr-9 sm:pl-5">
              {["group-1", "group-2"].map((id) => (
                <div
                  className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm"
                  key={id}
                >
                  <div className="size-12 rounded-full bg-muted motion-safe:animate-pulse" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="h-5 w-24 rounded bg-muted motion-safe:animate-pulse" />
                    <div className="mt-auto">
                      <div className="h-6 w-24 rounded-full bg-muted motion-safe:animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 pt-4 sm:px-5 sm:pt-5">
              <div className="h-8 w-24 rounded-md bg-muted motion-safe:animate-pulse" />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Loading;
