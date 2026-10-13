import { expect, type Locator, type Page } from "@playwright/test";

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

  expectDisabled = async () => {
    await expect(this.emailInput).toBeDisabled();
    await expect(this.passwordInput).toBeDisabled();
    await expect(this.submitButton).toBeDisabled();
  };

  getSignUpLink = () => this.signUpLink;

  getSubmitButton = () => this.submitButton;
}

export { LoginPage };
