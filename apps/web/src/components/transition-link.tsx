"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ComponentProps, startTransition, addTransitionType } from "react";

type TransitionLinkProps = ComponentProps<typeof Link> & {
  transitionType?: "nav-forward" | "nav-back";
};

const TransitionLink = ({ transitionType, href, onClick, ...props }: TransitionLinkProps) => {
  const router = useRouter();

  if (!transitionType) {
    return <Link href={href} {...props} />;
  }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onClick?.(e);
    startTransition(() => {
      addTransitionType(transitionType);
      router.push(typeof href === "string" ? href : (href.pathname ?? "/"));
    });
  };

  return <Link href={href} onClick={handleClick} {...props} />;
};

export { TransitionLink };
export type { TransitionLinkProps };
