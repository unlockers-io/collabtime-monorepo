const Loading = () => {
  return (
    <div className="min-h-dvh w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <main className="mx-auto flex w-full max-w-450 flex-col gap-6">
        <header className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="size-9 animate-pulse rounded-lg bg-muted" />
              <div className="h-7 w-40 animate-pulse rounded-lg bg-muted" />
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <div className="h-9 w-36 animate-pulse rounded-lg bg-muted" />
              <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
              <div className="size-9 animate-pulse rounded-lg bg-muted" />
              <div className="size-9 animate-pulse rounded-lg bg-muted" />
            </div>
            <div className="flex items-center sm:hidden">
              <div className="size-9 animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
        </header>

        <section className="flex flex-col gap-4 rounded-xl border bg-card py-4 text-card-foreground shadow-sm sm:py-5">
          <div className="flex items-center gap-2 px-4 sm:px-5">
            <div className="size-4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
          <div className="grid gap-3 px-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
            {["insight-1", "insight-2", "insight-3"].map((id) => (
              <div
                className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-secondary/40 p-3.5"
                key={id}
              >
                <div className="flex items-center gap-2">
                  <div className="size-4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  <div className="ml-auto h-5 w-6 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="flex flex-wrap gap-1.5 px-1 py-0.5">
                  {["chip-a", "chip-b"].map((chipId) => (
                    <div className="h-6 w-16 animate-pulse rounded-full bg-muted" key={chipId} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border bg-card py-4 text-card-foreground shadow-sm sm:py-5">
          <div className="flex flex-col gap-0.5 border-b px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="flex items-center gap-2">
              <div className="size-4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-3 w-36 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex flex-col gap-6 px-4 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="w-28" />
              <div className="flex flex-1 justify-between">
                {["tick-1", "tick-2", "tick-3", "tick-4", "tick-5"].map((id) => (
                  <div className="h-3 w-12 animate-pulse rounded bg-muted" key={id} />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {["row-1", "row-2", "row-3"].map((id) => (
                <div className="flex items-center gap-3" key={id}>
                  <div className="flex w-28 items-center gap-2">
                    <div className="size-7 animate-pulse rounded-full bg-muted" />
                    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-8 flex-1 animate-pulse rounded-lg bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <section className="flex flex-col gap-4 rounded-xl border bg-card py-4 text-card-foreground shadow-sm sm:py-5">
            <div className="flex items-center justify-between px-4 sm:px-5">
              <div className="flex items-center gap-2">
                <div className="size-4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-5 w-8 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,320px))] gap-4 px-4 sm:px-5">
              {["member-1", "member-2", "member-3", "member-4"].map((id) => (
                <div
                  className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm"
                  key={id}
                >
                  <div className="size-12 animate-pulse rounded-full bg-muted" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="mt-auto flex flex-col gap-1">
                      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 pt-4 sm:px-5 sm:pt-5">
              <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
              <div className="h-8 w-36 animate-pulse rounded-md bg-muted" />
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-xl border bg-card py-4 text-card-foreground shadow-sm sm:py-5">
            <div className="flex items-center justify-between px-4 sm:px-5">
              <div className="flex items-center gap-2">
                <div className="size-4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-5 w-8 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,320px))] gap-4 px-4 sm:px-5">
              {["group-1", "group-2"].map((id) => (
                <div
                  className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm"
                  key={id}
                >
                  <div className="size-12 animate-pulse rounded-full bg-muted" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                    <div className="mt-auto">
                      <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 pt-4 sm:px-5 sm:pt-5">
              <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Loading;
