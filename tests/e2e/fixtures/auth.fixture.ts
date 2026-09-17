import { test as base } from "@playwright/test";

import { HomePage } from "../pages/home.page";
import { LoginPage } from "../pages/login.page";
import { RegisterPage } from "../pages/register.page";

const TEST_USER = {
  email: "e2e-test@collabtime.localhost",
  name: "E2E Test User",
  password: "TestPassword123!",
};

type Fixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  testUser: typeof TEST_USER;
};

const test = base.extend<Fixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  testUser: async ({}, use) => {
    await use(TEST_USER);
  },
});

export { test, TEST_USER };
export { expect } from "@playwright/test";
