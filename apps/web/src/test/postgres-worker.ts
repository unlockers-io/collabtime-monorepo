const server = process.env.TEST_DATABASE_SERVER;

if (server !== undefined) {
  const database = new URL(server);
  database.pathname = `${database.pathname}_test_${process.env.VITEST_POOL_ID}`;
  process.env.DATABASE_URL = database.toString();
}
