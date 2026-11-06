import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import type { TeamMember } from "@/types";

import { EditMemberDialog } from "./edit-member-dialog";

const mocks = vi.hoisted(() => ({ changeTeam: vi.fn() }));

vi.mock("@/lib/actions/team-change", () => mocks);

vi.mock("@/lib/actions/invitation-actions", () => ({ inviteMember: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
});

const member: TeamMember = {
  id: "6f1c1c3e-6a3b-4b8f-9f55-0a3c2d1e4b7a",
  name: "Ada",
  order: 0,
  timezone: "Europe/London",
  title: "Engineer",
  userId: "user-1",
  workingHoursEnd: 17,
  workingHoursStart: 9,
};

const renderDialog = (mode: "admin" | "claim" = "admin") => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditMemberDialog
        groups={[]}
        member={member}
        mode={mode}
        onOpenChange={vi.fn<(open: boolean) => void>()}
        open
        teamId="team-1"
      />
    </QueryClientProvider>,
  );

  return screen.getByLabelText("Full name");
};

const formAlertText = () => document.querySelector('[data-slot="form-alert"]')?.textContent;

it("sends nothing for an unchanged save and says so until the next change", async () => {
  const name = renderDialog();
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() => {
    expect(formAlertText()).toBe("No changes to save.");
  });
  expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  expect(mocks.changeTeam).not.toHaveBeenCalled();

  fireEvent.change(name, { target: { value: "Ada Lovelace" } });
  expect(formAlertText()).toBeUndefined();
});

it("claims an unchanged profile, since claiming is the change", async () => {
  mocks.changeTeam.mockResolvedValue({ data: undefined, success: true });
  renderDialog("claim");
  fireEvent.click(screen.getByRole("button", { name: "Claim profile" }));

  await waitFor(() => {
    expect(mocks.changeTeam).toHaveBeenCalledExactlyOnceWith(
      "team-1",
      "updateOwnMember",
      expect.objectContaining({ memberId: member.id }),
    );
  });
});

it("reports a failed save in the form alert", async () => {
  mocks.changeTeam.mockResolvedValue({ error: "Member not found", success: false });
  const name = renderDialog();
  expect(name).toHaveAccessibleDescription("Up to 100 characters.");
  fireEvent.change(name, { target: { value: "Ada Lovelace" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() => {
    expect(formAlertText()).toBe("Member not found");
  });
});
