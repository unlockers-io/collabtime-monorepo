import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ProductPreview } from "./product-preview";
import { Section } from "./section";
import { LANDING_CTA_SIZE } from "./styles";

const Hero = () => (
  <Section className="pt-12 sm:pt-24">
    <div className="flex flex-col gap-16 sm:gap-24">
      <div className="grid items-end gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-20">
        <h1 className="max-w-[11ch] font-display text-6xl leading-[0.92] font-semibold tracking-[-0.04em] text-balance sm:text-8xl">
          Find the hour everyone is awake
        </h1>

        <div className="flex flex-col items-start gap-7 lg:pb-2">
          <p className="max-w-[42ch] text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
            See every teammate&apos;s working hours on one timeline, and the overlap where a meeting
            actually works.
          </p>

          <div className="flex flex-col items-start gap-3">
            <Link className={cn(buttonVariants({ size: "lg" }), LANDING_CTA_SIZE)} href="/signup">
              Create a workspace
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
      </div>

      <div className="time-rail w-full">
        <ProductPreview />
      </div>
    </div>
  </Section>
);

export { Hero };
