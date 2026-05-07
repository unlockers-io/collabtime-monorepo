import type { Locator, Page } from "@playwright/test";

class SignupPage {
  private readonly nameInput: Locator;
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;
  private readonly signInLink: Locator;

  constructor(private readonly page: Page) {
    this.nameInput = page.getByLabel("Name");
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Password");
    this.submitButton = page.getByRole("button", { name: /create account/i });
    this.signInLink = page.getByRole("link", { name: /sign in/i });
  }

  goto = async () => {
    await this.page.goto("/signup");
  };

  signup = async (name: string, email: string, password: string) => {
    await this.nameInput.click();
    await this.nameInput.fill(name);
    await this.page.keyboard.press("Tab");
    await this.emailInput.click();
    await this.emailInput.fill(email);
    await this.page.keyboard.press("Tab");
    await this.passwordInput.click();
    await this.passwordInput.fill(password);
    await this.page.keyboard.press("Tab");
    await this.submitButton.click();
  };

  getSignInLink = () => this.signInLink;

  getSubmitButton = () => this.submitButton;
}

export { SignupPage };
