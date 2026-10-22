import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { CreateWorkspaceDialogView } from "./create-workspace-dialog";

it("disables creation until a name is entered and submits it trimmed", async () => {
  const createWorkspace = vi.fn().mockResolvedValue({ data: "team", success: true });
  const onCreated = vi.fn<(id: string) => void>();
  render(<CreateWorkspaceDialogView createWorkspace={createWorkspace} onCreated={onCreated} />);
  fireEvent.click(screen.getByRole("button", { name: "Create a workspace" }));
  const input = await screen.findByLabelText("Workspace name");
  const submit = screen.getByRole("button", { name: /^Create workspace$/ });
  expect(submit).toBeDisabled();
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.blur(input);
  expect(submit).toBeDisabled();
  expect(screen.queryByText("Workspace name is required")).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: "  Platform  " } });
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  await waitFor(() => {
    expect(createWorkspace).toHaveBeenCalledWith("Platform");
  });
  expect(onCreated).toHaveBeenCalledWith("team");
});
it("validates the name only once creation is attempted", async () => {
  const createWorkspace = vi.fn();
  render(
    <CreateWorkspaceDialogView
      createWorkspace={createWorkspace}
      onCreated={vi.fn<(id: string) => void>()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Create a workspace" }));
  const input = await screen.findByLabelText("Workspace name");
  fireEvent.change(input, { target: { value: "x".repeat(101) } });
  fireEvent.blur(input);
  const error = "Workspace name must be 100 characters or less";
  expect(screen.queryByText(error)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Create workspace$/ }));
  expect(await screen.findByText(error)).toBeVisible();
  expect(createWorkspace).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "Platform" } });
  await waitFor(() => {
    expect(screen.queryByText(error)).not.toBeInTheDocument();
  });
});
it("keeps the entered name and reports creation failure", async () => {
  const createWorkspace = vi
    .fn()
    .mockResolvedValue({ error: "Team storage is unavailable", success: false });
  render(
    <CreateWorkspaceDialogView
      createWorkspace={createWorkspace}
      onCreated={vi.fn<(id: string) => void>()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Create a workspace" }));
  fireEvent.change(await screen.findByLabelText("Workspace name"), {
    target: { value: "Platform" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Create workspace$/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Team storage is unavailable");
  expect(screen.getByLabelText("Workspace name")).toHaveValue("Platform");
});
