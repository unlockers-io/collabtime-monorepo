const Loading = () => {
  return (
    <div className="flex min-h-screen items-start justify-center bg-neutral-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-12">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="h-8 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-4 w-72 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <div className="h-10 w-28 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
        </div>

        {/* Timezone Visualizer Skeleton */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-24" />
              <div className="flex flex-1 justify-between">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-4 w-12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                  <div className="h-6 flex-1 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team Members Section Skeleton */}
        <div className="flex flex-col gap-4">
          <div className="h-6 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex flex-col gap-2">
                  <div className="h-5 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                  <div className="h-4 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-8 w-8 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700" />
                  <div className="h-8 w-8 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Loading;
