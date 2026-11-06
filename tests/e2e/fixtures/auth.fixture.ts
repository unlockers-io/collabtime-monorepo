import { test as base } from "@playwright/test";

import { HomePage } from "../pages/home.page";
import { LoginPage } from "../pages/login.page";
import { RegisterPage } from "../pages/register.page";
import { E2E_USER } from "../support/users";

type Fixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  testUser: typeof E2E_USER;
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
    await use(E2E_USER);
  },
});

export { test };

export { expect } from "@playwright/test";
