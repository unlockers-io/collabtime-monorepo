import { describe, expect, it } from "vitest";

import { createTestMember, createTestTeamRecord, VALID_UUID } from "./actions/test-helpers";
import { decodeTeam } from "./team-record-codec";

describe("Redis cutover decoding", () => {
  it("preserves wire fields, normalizes legacy order and drops private fencing tokens", () => {
    const team = createTestTeamRecord({
      adminPasswordHash: "private",
      members: [createTestMember()],
    });
    const stored = JSON.stringify({
      ...team,
      members: [
        {
          ...team.members[0],
          groupId: "missing",
          membershipRevision: "obsolete",
          order: undefined,
        },
      ],
    });
    expect(decodeTeam(VALID_UUID, stored)).toEqual(team);
  });
  it("refuses invalid IDs, corrupt data, duplicate IDs and invalid timezones", () => {
    const team = JSON.stringify(createTestTeamRecord());
    const duplicates = JSON.stringify(
      createTestTeamRecord({ members: [createTestMember(), createTestMember()] }),
    );
    const invalidZone = JSON.stringify(
      createTestTeamRecord({ members: [createTestMember({ timezone: "Invalid/Zone" })] }),
    );
    expect(() => decodeTeam("other-id", team)).toThrow("ID differ");
    expect(() => decodeTeam(VALID_UUID, "42")).toThrow("Invalid input");
    expect(() => decodeTeam(VALID_UUID, duplicates)).toThrow("Duplicate");
    expect(() => decodeTeam(VALID_UUID, invalidZone)).toThrow("Invalid time zone");
  });
});
