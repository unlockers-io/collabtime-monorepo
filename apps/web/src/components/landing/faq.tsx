import { Section } from "./section";

const QUESTIONS = [
  {
    answer:
      "Not to look at one. Public workspaces open for anyone with the link, so you can drop it in a channel and teammates can read the timeline without signing up. Creating a workspace does need an account.",
    question: "Do I need an account?",
  },
  {
    answer:
      "Yes. Mark a workspace private and it sits behind a password, and members can sign in to access it.",
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

const FAQ_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: QUESTIONS.map(({ answer, question }) => ({
    "@type": "Question",
    acceptedAnswer: { "@type": "Answer", text: answer },
    name: question,
  })),
}).replaceAll("<", String.raw`\u003c`);

const Faq = () => (
  <Section className="border-t border-border" id="faq">
    <script type="application/ld+json">{FAQ_JSON_LD}</script>
    <div className="grid gap-12 lg:grid-cols-faq lg:gap-20">
      <h2 className="font-display text-4xl font-semibold tracking-hero text-balance sm:text-5xl">
        Questions
      </h2>

      <dl className="grid sm:grid-cols-2">
        {QUESTIONS.map(({ answer, question }) => (
          <div
            className="flex min-h-40 flex-col gap-2 border-t border-border py-5 pr-6 sm:even:border-l sm:even:pl-6"
            key={question}
          >
            <dt className="text-base font-medium text-foreground sm:text-lg">{question}</dt>
            <dd className="max-w-(--container-measure-footer) text-base text-pretty text-muted-foreground sm:text-sm">
              {answer}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  </Section>
);

export { Faq };
