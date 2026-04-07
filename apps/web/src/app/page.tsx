import { getSession } from "@/lib/auth-server";

import { HomeClient } from "./home-client";

const Home = async () => {
  const session = await getSession();

  return <HomeClient isAuthenticated={Boolean(session)} />;
};

export default Home;
