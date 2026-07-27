import { Globe } from "lucide-react";
import Link from "next/link";

type NavLogoProps = {
  showTitle?: boolean;
};

const NavLogo = ({ showTitle = true }: NavLogoProps) => (
  <Link
    aria-label="Collab Time, homepage"
    className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-80"
    href="/"
  >
    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary">
      <Globe className="size-5 text-primary-foreground" />
    </div>
    {showTitle && (
      <span className="font-display text-xl font-bold tracking-tight">Collab Time</span>
    )}
  </Link>
);

export { NavLogo };
