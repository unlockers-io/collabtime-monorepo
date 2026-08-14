import { Layers, Share2, Sunrise, Upload, Users, Watch } from "lucide-react";

import { Section } from "./section";

const FEATURES = [
  {
    description:
      "Every member's working hours sit on a shared 24-hour axis, drawn in your timezone. A live marker tracks the current hour.",
    icon: Watch,
    title: "One timeline, every timezone",
  },
  {
    description:
      "Select any mix of people or groups and the overlap is shaded in: full overlap, partial, and the hours where each team has someone free.",
    icon: Layers,
    title: "Overlap you can see",
  },
  {
    description:
      "Sort people into squads, collapse the ones you are not scheduling around, and drag to reorder.",
    icon: Users,
    title: "Groups that match your org",
  },
  {
    description:
      "Send an email invite, or share the workspace link so anyone can read it without an account. Private workspaces sit behind a password.",
    icon: Share2,
    title: "Invite people or share a link",
  },
  {
    description:
      "Paste a CSV to add the whole team at once, with a preview of every row before anything is saved.",
    icon: Upload,
    title: "Import a CSV",
  },
  {
    description:
      "A running summary of who is working, who starts within the next couple of hours, and who is done for the day.",
    icon: Sunrise,
    title: "See who is working right now",
  },
];

const Features = () => (
  <Section>
    <div className="flex flex-col gap-12 sm:gap-16">
      <div>
        <h2 className="max-w-[35ch] font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Everything you need to schedule across timezones
        </h2>
        <p className="mt-6 max-w-[48ch] text-lg text-pretty text-muted-foreground">
          No spreadsheets, no mental arithmetic, and no 6am call that nobody actually agreed to.
        </p>
      </div>

      <dl className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ description, icon: Icon, title }) => (
          <div className="flex flex-col gap-1" key={title}>
            <dt className="flex items-start gap-3 text-base font-medium text-foreground sm:text-lg">
              <Icon aria-hidden className="size-6 h-lh shrink-0 text-primary" />
              {title}
            </dt>
            <dd className="pl-9 text-base text-pretty text-muted-foreground sm:text-sm">
              {description}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  </Section>
);

export { Features };
