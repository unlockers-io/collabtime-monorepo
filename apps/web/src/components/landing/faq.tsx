import { Section } from "./section";

const QUESTIONS = [
  {
    answer:
      "Not to look at one. Public workspaces open for anyone with the link, so you can drop it in a channel and teammates can read the timeline without signing up. Creating a workspace does need an account.",
    question: "Do I need an account?",
  },
  {
    answer:
      "Yes. Mark a workspace private and it sits behind a password, so only people you give it to can open the link.",
    question: "Can I keep a workspace private?",
  },
  {
    answer: "Nothing. There is no paid tier, no trial, and no billing in the product at all.",
    question: "What does it cost?",
  },
  {
    answer:
      "Working hours are stored against each person's own timezone and converted into yours using that region's current UTC offset, so the bands shift on their own when a region changes its clocks.",
    question: "How does it handle daylight saving?",
  },
];

const Faq = () => (
  <Section className="border-t border-border">
    <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
      <h2 className="font-display text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
        Questions
      </h2>

      <dl className="grid sm:grid-cols-2">
        {QUESTIONS.map(({ answer, question }) => (
          <div
            className="flex min-h-40 flex-col gap-2 border-t border-border py-5 pr-6 sm:even:border-l sm:even:pl-6"
            key={question}
          >
            <dt className="text-base font-medium text-foreground sm:text-lg">{question}</dt>
            <dd className="max-w-[56ch] text-base text-pretty text-muted-foreground sm:text-sm">
              {answer}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  </Section>
);

export { Faq };
