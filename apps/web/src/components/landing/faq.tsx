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
  <Section>
    <div className="flex flex-col gap-12 sm:gap-16">
      <h2 className="max-w-[35ch] font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Questions
      </h2>

      <dl className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
        {QUESTIONS.map(({ answer, question }) => (
          <div className="flex flex-col gap-2" key={question}>
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
