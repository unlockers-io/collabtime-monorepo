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

export { PageMain };
