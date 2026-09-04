import { GithubIcon } from "@/components/github-icon";
import { APP_REPO_URL } from "@/lib/constants";

import { Section } from "./section";

const STACK = ["Next.js", "React", "Prisma", "Better Auth", "Tailwind CSS"];

const OpenSource = () => (
  <Section className="border-t border-border">
    <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
      <p className="text-base text-muted-foreground sm:text-sm">
        Open source, and built on tools you already know.
      </p>

      <div className="flex flex-col items-start gap-8 border-t border-border pt-6">
        <ul className="flex flex-wrap items-center gap-x-8 gap-y-3">
          {STACK.map((name) => (
            <li className="font-display text-base text-foreground sm:text-lg" key={name}>
              {name}
            </li>
          ))}
        </ul>

        <a
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          href={APP_REPO_URL}
          rel="noreferrer"
          target="_blank"
        >
          <GithubIcon className="size-5 h-lh" />
          Read the source on GitHub
        </a>
      </div>
    </div>
  </Section>
);

export { OpenSource };
