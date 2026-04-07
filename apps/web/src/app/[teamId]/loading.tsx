"use client";

import { Skeleton } from "boneyard-js/react";

const TeamDashboardFixture = () => (
  <div className="px-4 py-6 sm:px-6 lg:px-8 xl:px-12 min-h-screen w-full">
    <main className="max-w-450 gap-6 mx-auto flex w-full flex-col">
      {/* Header */}
      <header className="gap-4 flex flex-col">
        <div className="gap-3 flex items-start justify-between">
          <div className="gap-3 flex items-center">
            <div className="h-10 w-10 rounded-xl bg-muted" />
            <div className="h-7 w-40 rounded-lg bg-muted" />
          </div>
          <div className="gap-2 flex items-center">
            <div className="h-10 w-28 rounded-lg bg-muted" />
            <div className="h-10 w-10 rounded-lg bg-muted" />
          </div>
        </div>
        <div className="h-4 w-64 rounded bg-muted" />
      </header>

      {/* Team Insights */}
      <div className="gap-4 sm:grid-cols-3 grid">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="gap-3 rounded-2xl p-4 shadow-sm flex items-center border border-border bg-card"
          >
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="gap-1.5 flex flex-col">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-5 w-8 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Timezone Visualizer */}
      <div className="rounded-2xl shadow-sm overflow-hidden border border-border bg-card">
        <div className="gap-1 px-4 py-3 sm:px-6 sm:py-4 flex flex-col border-b border-border">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-3 w-36 rounded bg-muted" />
        </div>
        <div className="gap-6 p-4 sm:p-6 flex flex-col">
          <div className="gap-3 flex items-center">
            <div className="w-28" />
            <div className="flex flex-1 justify-between">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-3 w-12 rounded bg-muted" />
              ))}
            </div>
          </div>
          <div className="gap-3 flex flex-col">
            {[0, 1, 2].map((i) => (
              <div key={i} className="gap-3 flex items-center">
                <div className="w-28 gap-2 flex items-center">
                  <div className="h-7 w-7 rounded-full bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                </div>
                <div className="h-8 flex-1 rounded-lg bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team Members & Groups */}
      <div className="gap-6 xl:grid-cols-2 grid grid-cols-1">
        {/* Team Members */}
        <section className="gap-4 rounded-2xl p-5 shadow-sm flex flex-col border border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="gap-2 flex items-center">
              <div className="h-5 w-5 rounded bg-muted" />
              <div className="h-6 w-32 rounded bg-muted" />
            </div>
            <div className="h-5 w-8 rounded-full bg-muted" />
          </div>
          <div className="gap-4 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-45 gap-3 rounded-2xl p-4 shadow-sm flex flex-col border border-border bg-card"
              >
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="gap-1.5 flex flex-1 flex-col">
                  <div className="h-5 w-24 rounded bg-muted" />
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="gap-1 mt-auto flex flex-col">
                    <div className="h-3 w-28 rounded bg-muted" />
                    <div className="h-3 w-20 rounded bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="h-10 w-full rounded-lg bg-muted" />
        </section>

        {/* Groups */}
        <section className="gap-4 rounded-2xl p-5 shadow-sm flex flex-col border border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="gap-2 flex items-center">
              <div className="h-5 w-5 rounded bg-muted" />
              <div className="h-6 w-20 rounded bg-muted" />
            </div>
            <div className="h-5 w-8 rounded-full bg-muted" />
          </div>
          <div className="gap-4 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
            {[0, 1].map((i) => (
              <div key={i} className="h-45 gap-3 rounded-2xl p-4 flex flex-col bg-secondary">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="gap-2 flex flex-1 flex-col">
                  <div className="h-5 w-24 rounded bg-muted" />
                  <div className="mt-auto">
                    <div className="h-6 w-24 rounded-full bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="h-10 w-full rounded-lg bg-muted" />
        </section>
      </div>
    </main>
  </div>
);

const Loading = () => {
  return (
    <Skeleton
      name="team-dashboard"
      loading={true}
      animate="pulse"
      fixture={<TeamDashboardFixture />}
      fallback={<TeamDashboardFixture />}
    >
      {null}
    </Skeleton>
  );
};

export default Loading;
