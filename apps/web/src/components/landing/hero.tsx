import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ProductPreview } from "./product-preview";
import { Section } from "./section";
import { LANDING_CTA_SIZE } from "./styles";

const Hero = () => (
  <Section className="pt-8 sm:pt-12">
    <div className="flex flex-col items-center gap-10 sm:gap-14">
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="font-display text-sm tracking-wide text-muted-foreground uppercase">
          For distributed teams
        </p>

        <h1 className="mx-auto max-w-[24ch] font-display text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Find the hour everyone is awake
        </h1>

        <p className="mx-auto max-w-[40ch] text-lg text-pretty text-muted-foreground sm:text-xl">
          See every teammate&apos;s working hours on one timeline, and the overlap where a meeting
          actually works.
        </p>

        <div className="flex flex-col items-center gap-3">
          <Link className={cn(buttonVariants({ size: "lg" }), LANDING_CTA_SIZE)} href="/signup">
            Get started
            <ArrowRight className="size-5 shrink-0" />
          </Link>
          <p className="text-base text-muted-foreground sm:text-sm">
            Already have an account?{" "}
            <Link className="font-medium text-foreground hover:underline" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="w-full">
        <ProductPreview />
      </div>
    </div>
  </Section>
);

export { Hero };
