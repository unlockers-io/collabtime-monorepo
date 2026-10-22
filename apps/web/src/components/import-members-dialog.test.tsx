import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { ImportMembersDialog } from "./import-members-dialog";

const mocks = vi.hoisted(() => ({ importMembers: vi.fn() }));

vi.mock("@/lib/actions/member-actions", () => ({ importMembers: mocks.importMembers }));

it("keeps import enabled with no valid rows and says why on click", async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ImportMembersDialog teamId="team-1" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Import from CSV" }));
  fireEvent.change(await screen.findByLabelText("Paste CSV data here"), {
    target: { value: "Name,Timezone\n,America/New_York" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));

  const submit = await screen.findByRole("button", { name: "Import 0 members" });
  expect(submit).toBeEnabled();
  fireEvent.click(submit);

  expect(await screen.findByRole("alert")).toHaveTextContent("No rows are ready to import");
  expect(mocks.importMembers).not.toHaveBeenCalled();
});
