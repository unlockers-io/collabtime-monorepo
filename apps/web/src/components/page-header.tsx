import type { ReactNode } from "react";

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

export { PageHeader };
