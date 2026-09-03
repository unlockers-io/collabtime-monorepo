import { Section } from "./section";

const FEATURES = [
  {
    description:
      "Every member's working hours sit on a shared 24-hour axis, drawn in your timezone. A live marker tracks the current hour.",
    title: "One timeline, every timezone",
  },
  {
    description:
      "Select any mix of people or groups and the overlap is shaded in: full overlap, partial, and the hours where each team has someone free.",
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
  <Section className="border-t border-border">
    <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
      <div>
        <h2 className="max-w-[14ch] font-display text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
          No timezone arithmetic.
        </h2>
        <p className="mt-6 max-w-[48ch] text-lg text-pretty text-muted-foreground">
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
            <dd className="max-w-[52ch] text-sm leading-relaxed text-pretty text-muted-foreground">
              {description}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  </Section>
);

export { Features };
