import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Section } from "./section";
import { LANDING_CTA_SIZE } from "./styles";

const Cta = () => (
  <Section className="border-t border-border">
    <div className="flex flex-col items-center gap-6 text-center">
      <h2 className="mx-auto max-w-[30ch] font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Stop guessing what time it is for everyone else
      </h2>

      <p className="mx-auto max-w-[48ch] text-lg text-pretty text-muted-foreground">
        Create a workspace, add your team, and share the link.
      </p>

      <Link
        className={cn(buttonVariants({ size: "lg", variant: "outline" }), LANDING_CTA_SIZE)}
        href="/signup"
      >
        Create a workspace
        <ArrowRight className="size-5 shrink-0" />
      </Link>
    </div>
  </Section>
);

export { Cta };
