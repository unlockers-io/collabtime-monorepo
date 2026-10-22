import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { AddGroupDialog } from "./add-group-dialog";

const mocks = vi.hoisted(() => ({ createGroup: vi.fn() }));

vi.mock("@/lib/actions/group-actions", () => ({ createGroup: mocks.createGroup }));

beforeEach(() => {
  vi.resetAllMocks();
});

const openDialog = async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AddGroupDialog teamId="team-1" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add group" }));

  return {
    name: await screen.findByLabelText("Group name"),
    submit: screen.getByRole("button", { name: "Create group" }),
  };
};

const tooLong = "Group name must be 50 characters or less";

it("explains the length limit up front and checks it only once creation is attempted", async () => {
  const { name, submit } = await openDialog();
  expect(name).toHaveAccessibleDescription("Up to 50 characters.");

  fireEvent.change(name, { target: { value: "x".repeat(51) } });
  expect(screen.queryByText(tooLong)).not.toBeInTheDocument();

  fireEvent.click(submit);
  expect(await screen.findByText(tooLong)).toBeVisible();
  await waitFor(() => {
    expect(name).toHaveFocus();
  });
  expect(mocks.createGroup).not.toHaveBeenCalled();
});

it("reports a failed write in the form alert and clears it on the next change", async () => {
  mocks.createGroup.mockResolvedValue({ error: "Group limit reached", success: false });
  const { name, submit } = await openDialog();
  fireEvent.change(name, { target: { value: "Design" } });

  fireEvent.click(submit);

  expect(await screen.findByRole("alert")).toHaveTextContent("Group limit reached");
  expect(name).toHaveValue("Design");
  fireEvent.change(name, { target: { value: "Design team" } });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
