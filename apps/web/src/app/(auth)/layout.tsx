import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type AuthLayoutProps = {
  children: React.ReactNode;
};

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-4 py-6 sm:px-6 flex" style={{ viewTransitionName: "site-header" }}>
        <Link
          href="/"
          className="gap-2 text-sm font-medium flex items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </header>
      <main className="px-4 pb-16 flex flex-1 items-center justify-center">{children}</main>
    </div>
  );
};

export default AuthLayout;
