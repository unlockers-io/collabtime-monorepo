import { ViewTransition } from "react";

import { getSession } from "@/lib/auth-server";

import { HomeClient } from "./home-client";

const Home = async () => {
  const session = await getSession();

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
