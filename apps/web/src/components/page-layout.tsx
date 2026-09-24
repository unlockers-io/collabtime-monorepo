import type { ReactNode } from "react";

type PageMainProps = {
  children: ReactNode;
};

// Matches the nav's grid so every page title starts on the same left edge as the logo.
const PageMain = ({ children }: PageMainProps) => (
  <main
    className="mx-auto flex w-full max-w-450 flex-1 flex-col gap-14 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 xl:px-12"
    id="main"
  >
    {children}
  </main>
);

type PageHeaderProps = {
  action?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
};

const PageHeader = ({ action, description, title }: PageHeaderProps) => (
  <div className="grid items-end gap-8 sm:grid-cols-content-action">
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-5xl font-semibold tracking-hero text-balance sm:text-7xl">
        {title}
      </h1>
      {description !== undefined && (
        <p className="max-w-lg text-base text-pretty text-muted-foreground sm:text-lg">
          {description}
        </p>
      )}
    </div>
    {action}
  </div>
);

export { PageHeader, PageMain };
