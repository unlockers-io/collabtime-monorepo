const Loading = () => {
  return (
    <div className="min-h-screen w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
        {/* Header Skeleton */}
        <header className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-7 w-40 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-28 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-10 w-10 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
          <div className="h-4 w-64 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        </header>

        {/* Team Insights Skeleton */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
              <div className="flex flex-col gap-1.5">
                <div className="h-3 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-5 w-8 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              </div>
            </div>
          ))}
        </div>

        {/* Timezone Visualizer Skeleton */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800 sm:px-6 sm:py-4">
            <div className="h-5 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="mt-1 h-3 w-36 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
          </div>
          <div className="flex flex-col gap-6 p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="w-28" />
              <div className="flex flex-1 justify-between">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-3 w-12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex w-28 items-center gap-2">
                    <div className="h-7 w-7 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
                    <div className="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                  </div>
                  <div className="h-8 flex-1 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team Members & Groups - Two column layout */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Team Members Section Skeleton */}
          <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-6 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              </div>
              <div className="h-5 w-8 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex h-[180px] flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="h-12 w-12 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
                  <div className="mt-3 flex flex-1 flex-col gap-1.5">
                    <div className="h-5 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                    <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                    <div className="mt-auto flex flex-col gap-1">
                      <div className="h-3 w-28 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                      <div className="h-3 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="h-10 w-full animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
          </section>

          {/* Groups Section Skeleton */}
          <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-6 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              </div>
              <div className="h-5 w-8 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="flex h-[180px] flex-col rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-800"
                >
                  <div className="h-12 w-12 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
                  <div className="mt-3 flex flex-1 flex-col gap-2">
                    <div className="h-5 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                    <div className="mt-auto">
                      <div className="h-6 w-24 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="h-10 w-full animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
          </section>
        </div>
      </main>
    </div>
  );
};

export default Loading;
