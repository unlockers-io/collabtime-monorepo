import { Globe } from "lucide-react";
import Link from "next/link";

type NavLogoProps = {
  showTitle?: boolean;
};

const NavLogo = ({ showTitle = true }: NavLogoProps) => (
  <Link
    aria-label={!showTitle ? "Go to homepage" : undefined}
    className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-80"
    href="/"
  >
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
      <Globe className="h-5 w-5 text-primary-foreground" />
    </div>
    {showTitle && <span className="text-xl font-bold tracking-tight">Collab Time</span>}
  </Link>
);

export { NavLogo };
