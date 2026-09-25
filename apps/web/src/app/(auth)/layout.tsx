import { Logo } from "@/components/nav/logo";

type AuthLayoutProps = {
  children: React.ReactNode;
};

const AuthLayout = ({ children }: AuthLayoutProps) => (
  <div className="flex flex-1 flex-col bg-background">
    <header className="mx-auto flex w-full max-w-450 items-center px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <Logo />
    </header>
    {/* Top-aligned, not centered: inline errors would otherwise shift the heading. */}
    <main className="flex-1 px-4 pt-6 pb-16 sm:px-6 sm:pt-16 sm:pb-24 lg:pt-24" id="main">
      <div className="mx-auto w-full max-w-sm">{children}</div>
    </main>
  </div>
);

export default AuthLayout;
