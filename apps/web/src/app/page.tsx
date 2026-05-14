import type { Metadata } from "next";

import { getSession } from "@/lib/auth-server";

import { HomeClient } from "./home-client";

export const metadata: Metadata = {
  description:
    "Create a workspace, add teammates with their timezones, and visualize working-hour overlap to find the best time to meet.",
  title: "Home",
};

const Home = async () => {
  const session = await getSession();

  return <HomeClient isAuthenticated={Boolean(session)} />;
};

export default Home;
