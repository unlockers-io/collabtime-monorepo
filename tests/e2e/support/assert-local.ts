const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

/** E2E setup and cleanup write to the database directly, so they refuse to run anywhere else. */
const assertLocalDatabase = (): void => {
  const value = process.env.DATABASE_URL ?? "";
  const host = URL.canParse(value) ? new URL(value).hostname : "";

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to touch DATABASE_URL at ${host || "an unparsable URL"}: not localhost.`,
    );
  }
};

export { assertLocalDatabase };
