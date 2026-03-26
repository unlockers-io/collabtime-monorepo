import type { Locator, Page } from "@playwright/test";

class HomePage {
  private readonly heading: Locator;
  private readonly createWorkspaceButton: Locator;
  private readonly getStartedLink: Locator;
  private readonly myTeamsHeading: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { name: "Collab Time" });
    this.createWorkspaceButton = page.getByRole("button", {
      name: /create team workspace/i,
    });
    this.getStartedLink = page.getByRole("link", { name: /get started/i });
    this.myTeamsHeading = page.getByRole("heading", { name: "My Teams" });
  }

  goto = async () => {
    await this.page.goto("/");
  };

  createWorkspace = async () => {
    await this.createWorkspaceButton.click();
  };

  getHeading = () => this.heading;

  getCreateWorkspaceButton = () => this.createWorkspaceButton;

  getGetStartedLink = () => this.getStartedLink;

  getMyTeamsHeading = () => this.myTeamsHeading;

  getTeamCards = () =>
    this.page.getByRole("article").filter({
      has: this.page.getByRole("link"),
    });
}

export { HomePage };
