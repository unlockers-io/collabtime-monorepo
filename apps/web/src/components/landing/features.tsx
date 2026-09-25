import { Section } from "./section";

const FEATURES = [
  {
    description:
      "Every member's working hours sit on a shared 24-hour axis, drawn in your timezone to the quarter hour, so half-hour zones like India line up exactly. A live line marks the current time.",
    title: "One timeline, every timezone",
  },
  {
    description:
      "The best time to meet is written out in your time, with who is free and who is not. Leave anyone out with one click, and see the hours when every group has someone working.",
    title: "Overlap you can see",
  },
  {
    description:
      "Sort people into squads, collapse the ones you are not scheduling around, and drag to reorder.",
    title: "Groups that match your org",
  },
  {
    description:
      "Send an email invite, or share the workspace link so anyone can read it without an account. Private workspaces sit behind a password.",
    title: "Invite people or share a link",
  },
  {
    description:
      "Paste a CSV to add the whole team at once, with a preview of every row before anything is saved.",
    title: "Import a CSV",
  },
  {
    description:
      "A running summary of who is working, who starts within the next couple of hours, and who is done for the day.",
    title: "See who is working right now",
  },
];

const Features = () => (
  <Section className="border-t border-border" id="features">
    <div className="grid gap-12 lg:grid-cols-faq lg:gap-20">
      <div>
        <h2 className="max-w-(--container-measure-14) font-display text-4xl font-semibold tracking-hero text-balance sm:text-5xl">
          No timezone arithmetic.
        </h2>
        <p className="mt-6 max-w-(--container-measure-body) text-lg text-pretty text-muted-foreground">
          No spreadsheets, no mental arithmetic, and no 6am call that nobody actually agreed to.
        </p>
      </div>

      <dl className="grid sm:grid-cols-2">
        {FEATURES.map(({ description, title }) => (
          <div
            className="flex min-h-36 flex-col gap-2 border-t border-border py-5 pr-6 sm:even:border-l sm:even:pl-6"
            key={title}
          >
            <dt className="text-base font-semibold text-foreground">{title}</dt>
            <dd className="max-w-(--container-measure-52) text-sm leading-relaxed text-pretty text-muted-foreground">
              {description}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  </Section>
);

export { Features };
