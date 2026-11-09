import Link from "next/link";

import { APP_NAME } from "@/lib/constants";

const Logo = () => (
  <Link
    aria-label={`${APP_NAME}, homepage`}
    className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-70"
    href="/"
  >
    <span aria-hidden="true" className="size-3.5 shrink-0 border-2 border-current" />
    <span className="font-display text-lg font-semibold tracking-display">{APP_NAME}</span>
  </Link>
);

export { Logo };
