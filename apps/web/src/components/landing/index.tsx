import { Nav } from "@/components/nav";

import { Cta } from "./cta";
import { Faq } from "./faq";
import { Features } from "./features";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { OpenSource } from "./open-source";

const LandingPage = () => (
  <div className="flex flex-1 flex-col bg-background">
    <Nav isAuthenticated={false} />

    <main className="flex flex-1 flex-col" id="main">
      <Hero />
      <Features />
      <HowItWorks />
      <OpenSource />
      <Faq />
      <Cta />
    </main>
  </div>
);

export { LandingPage };
