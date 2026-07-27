import { cn } from "@repo/ui/lib/utils";

type SectionProps = {
  children: React.ReactNode;
  className?: string;
  id?: string;
};

// Horizontal padding and max-width match the global footer in app/layout.tsx so
// every content edge on the page lines up while scrolling.
const Section = ({ children, className, id }: SectionProps) => (
  <section className={cn("px-4 py-16 sm:px-6 sm:py-24 lg:px-8 xl:px-12", className)} id={id}>
    <div className="mx-auto w-full max-w-450">{children}</div>
  </section>
);

export { Section };
