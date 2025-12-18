import Link from "next/link";
import { Globe } from "lucide-react";

type AuthLayoutProps = {
  children: React.ReactNode;
};

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-center py-8">
        <Link
          href="/"
          className="flex items-center gap-3 text-neutral-900 transition-opacity hover:opacity-80 dark:text-neutral-100"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 dark:bg-neutral-100">
            <Globe className="h-5 w-5 text-white dark:text-neutral-900" />
          </div>
          <span className="text-xl font-bold tracking-tight">Collab Time</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        {children}
      </main>
    </div>
  );
};

export default AuthLayout;
