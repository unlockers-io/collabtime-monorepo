"use server";

import { authorizeTeamAdmin } from "@/lib/team-auth";

import { createGroupActions } from "./group-actions-core";
import { mutateTeam } from "./helpers";

const { createGroup, removeGroup, reorderGroups, updateGroup } = createGroupActions({
  authorizeTeamAdmin,
  mutateTeam,
});

export { createGroup, removeGroup, reorderGroups, updateGroup };
