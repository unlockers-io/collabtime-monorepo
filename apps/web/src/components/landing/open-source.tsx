import { GithubIcon } from "@/components/github-icon";
import { APP_REPO_URL } from "@/lib/constants";

import { Section } from "./section";

const STACK = ["Next.js", "React", "Prisma", "Better Auth", "Tailwind CSS"];

const OpenSource = () => (
  <Section className="border-t border-border">
    <div className="flex flex-col items-center gap-8 text-center">
      <p className="text-base text-muted-foreground sm:text-sm">
        Open source, and built on tools you already know.
      </p>

      <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {STACK.map((name) => (
          <li className="font-display text-base text-foreground sm:text-lg" key={name}>
            {name}
          </li>
        ))}
      </ul>

      <a
        className="inline-flex items-center gap-2 text-base font-medium text-muted-foreground hover:text-foreground sm:text-sm"
        href={APP_REPO_URL}
        rel="noreferrer"
        target="_blank"
      >
        <GithubIcon className="size-5 h-lh" />
        Read the source on GitHub
      </a>
    </div>
  </Section>
);

export { OpenSource };
