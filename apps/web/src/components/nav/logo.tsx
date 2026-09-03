import Link from "next/link";

type NavLogoProps = {
  showTitle?: boolean;
};

const Logo = ({ showTitle = true }: NavLogoProps) => (
  <Link
    aria-label="Collab Time, homepage"
    className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-70"
    href="/"
  >
    <span aria-hidden="true" className="size-3.5 shrink-0 border-2 border-current" />
    {showTitle && (
      <span className="font-display text-lg font-semibold tracking-[-0.03em]">Collabtime</span>
    )}
  </Link>
);

export { Logo };
