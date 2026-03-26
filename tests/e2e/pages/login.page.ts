import type { Locator, Page } from "@playwright/test";

class LoginPage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;
  private readonly signUpLink: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Password");
    this.submitButton = page.getByRole("button", { name: /sign in/i });
    this.signUpLink = page.getByRole("link", { name: /sign up/i });
  }

  goto = async () => {
    await this.page.goto("/login");
  };

  login = async (email: string, password: string) => {
    await this.emailInput.click();
    await this.emailInput.fill(email);
    await this.page.keyboard.press("Tab");
    await this.passwordInput.click();
    await this.passwordInput.fill(password);
    await this.page.keyboard.press("Tab");
    await this.submitButton.click();
  };

  getSignUpLink = () => this.signUpLink;

  getSubmitButton = () => this.submitButton;
}

export { LoginPage };
