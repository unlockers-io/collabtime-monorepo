"use server";

import { v4 as uuidv4 } from "uuid";

import { authorizeTeamAdmin } from "@/lib/team-auth";

import { createGroupActions } from "./group-actions-core";
import { mutateTeam } from "./helpers";

const { createGroup, removeGroup, reorderGroups, updateGroup } = createGroupActions({
  authorizeTeamAdmin,
  createId: uuidv4,
  mutateTeam,
});

export { createGroup, removeGroup, reorderGroups, updateGroup };
