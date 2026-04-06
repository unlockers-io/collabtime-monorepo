import { ViewTransition } from "react";

import { getSession } from "@/lib/auth-server";

import { HomeClient } from "./home-client";

const Home = async () => {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // Degrade gracefully — show unauthenticated view if session fetch fails
  }

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <HomeClient isAuthenticated={Boolean(session)} />
    </ViewTransition>
  );
};

export default Home;
