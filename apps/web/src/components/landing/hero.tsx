import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ProductPreview } from "./product-preview";
import { Section } from "./section";
import { LANDING_CTA_SIZE } from "./styles";

const getHourClassName = (index: number): string => {
  if (index >= 6 && index <= 8) {
    return "bg-primary";
  }

  if (index >= 3 && index <= 10) {
    return "bg-foreground/35";
  }

  return "bg-muted";
};

const Hero = () => (
  <Section className="pt-10 sm:pt-16">
    <div className="flex flex-col gap-10 sm:gap-14">
      <div className="grid items-end gap-10 lg:grid-cols-[1fr_0.72fr] lg:gap-16">
        <div className="flex flex-col items-start gap-6">
          <p className="font-display text-sm tracking-wide text-primary">For distributed teams</p>

          <h1 className="max-w-[16ch] font-display text-5xl leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-7xl">
            Find the hour everyone is awake
          </h1>

          <p className="max-w-[44ch] text-lg text-pretty text-muted-foreground sm:text-xl">
            See every teammate&apos;s working hours on one timeline, and the overlap where a meeting
            actually works.
          </p>

          <div className="flex flex-col items-start gap-3">
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

        <div className="border border-border bg-background/70 p-5 backdrop-blur sm:p-6">
          <div className="flex items-center justify-between gap-4 font-display text-xs text-muted-foreground">
            <span>Shared day</span>
            <span className="flex items-center gap-2 text-primary">
              <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
              overlap found
            </span>
          </div>
          <div
            aria-hidden="true"
            className="mt-5 grid h-12 grid-cols-12 gap-px overflow-hidden rounded-sm bg-border p-px"
          >
            {Array.from({ length: 12 }, (_, index) => (
              <span className={getHourClassName(index)} key={index} />
            ))}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 font-display text-sm">
            <div>
              <dt className="text-muted-foreground">San Francisco</dt>
              <dd className="mt-1 text-foreground">PDT</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">New York</dt>
              <dd className="mt-1 text-foreground">EDT</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">London</dt>
              <dd className="mt-1 text-foreground">GMT+1</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Singapore</dt>
              <dd className="mt-1 text-foreground">GMT+8</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="time-rail w-full">
        <ProductPreview />
      </div>
    </div>
  </Section>
);

export { Hero };
