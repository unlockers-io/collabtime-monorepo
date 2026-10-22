import "@testing-library/jest-dom/vitest";

import { SortableContext } from "@dnd-kit/sortable";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { SortableMemberCard } from "@/components/sortable-member-card";
import type { TeamMember } from "@/types";

import { DndWrapper } from "./dnd-wrapper";

const member: TeamMember = {
  id: "member-1",
  name: "Pedro Filho",
  order: 0,
  timezone: "America/Sao_Paulo",
  title: "",
  userId: "user-1",
  workingHoursEnd: 17,
  workingHoursStart: 9,
};

it("keeps the dragged card's controls and badges on the drag overlay", async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DndWrapper groups={[]} members={[member]} onDragEnd={vi.fn<() => void>()}>
        <SortableContext items={[member.id]}>
          <SortableMemberCard
            canEdit
            currentUserId="user-1"
            groups={[]}
            hasClaimedProfile
            member={member}
            teamId="team-1"
          />
        </SortableContext>
      </DndWrapper>
    </QueryClientProvider>,
  );

  const handle = screen.getByRole("button", { name: "Move Pedro Filho" });
  handle.focus();
  fireEvent.keyDown(handle, { code: "Space" });

  await waitFor(() => {
    expect(screen.getAllByText("You")).toHaveLength(2);
  });
  const overlay = screen.getAllByText("You")[1]?.closest("[inert]");
  expect(overlay).not.toBeNull();
  expect(overlay?.querySelector('[aria-label="Edit Pedro Filho"]')).not.toBeNull();
  expect(overlay?.querySelector('[aria-label="More actions for Pedro Filho"]')).not.toBeNull();
  expect(overlay?.querySelector(".lucide-grip-vertical")).not.toBeNull();
});
