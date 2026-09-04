import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Section } from "./section";
import { LANDING_CTA_SIZE } from "./styles";

const Cta = () => (
  <Section className="border-t border-border">
    <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
      <div>
        <h2 className="max-w-[22ch] font-display text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
          Stop guessing what time it is for everyone else
        </h2>

        <p className="mt-5 max-w-[48ch] text-lg text-pretty text-muted-foreground">
          Create a workspace, add your team, and share the link.
        </p>
      </div>

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
