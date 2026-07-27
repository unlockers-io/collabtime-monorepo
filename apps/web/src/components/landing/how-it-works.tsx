import { Section } from "./section";

const STEPS = [
  {
    body: "One click creates a workspace with you on the timeline. Nothing to configure first",
    title: "Create a workspace",
  },
  {
    body: "Invite them by email, send the link, or paste a CSV to add everyone at once",
    title: "Add your team",
  },
  {
    body: "Select the people you need and read the shaded window where they all overlap",
    title: "Find the hour",
  },
];

const HowItWorks = () => (
  <Section>
    <div className="flex flex-col gap-12 sm:gap-16">
      <h2 className="max-w-[35ch] font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Three steps to a workable meeting time
      </h2>

      <ol className="grid list-decimal gap-x-8 gap-y-10 pl-5 sm:grid-cols-3">
        {STEPS.map(({ body, title }) => (
          <li className="pl-2 marker:font-display marker:text-muted-foreground" key={title}>
            <p className="text-base font-medium text-foreground sm:text-lg">{title}</p>
            <p className="mt-1 text-base text-pretty text-muted-foreground sm:text-sm">{body}</p>
          </li>
        ))}
      </ol>
    </div>
  </Section>
);

export { HowItWorks };
