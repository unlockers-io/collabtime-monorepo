import { displayName } from "@repo/identity";
import Link from "next/link";

const Logo = () => (
  <Link
    aria-label={`${displayName}, homepage`}
    className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-70"
    href="/"
  >
    <span aria-hidden="true" className="size-3.5 shrink-0 border-2 border-current" />
    <span className="font-display text-lg font-semibold tracking-display">{displayName}</span>
  </Link>
);

export { Logo };
