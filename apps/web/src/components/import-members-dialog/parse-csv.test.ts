import { describe, expect, it } from "vitest";

import { parseCSV } from "./parse-csv";

describe("parseCSV", () => {
  it("reads a file with a header into valid member rows", () => {
    const rows = parseCSV(
      [
        "Name,Timezone,Role,Work Start,Work End",
        "Alice Johnson,America/New_York,Engineering Lead,9,17",
        '"Smith, Bob",Europe/London,,8,16',
      ].join("\n"),
    );

    expect(rows).toStrictEqual([
      {
        errors: [],
        index: 1,
        member: {
          groupId: undefined,
          name: "Alice Johnson",
          timezone: "America/New_York",
          title: "Engineering Lead",
          workingHoursEnd: 17,
          workingHoursStart: 9,
        },
        rawTimezone: "America/New_York",
      },
      {
        errors: [],
        index: 2,
        member: {
          groupId: undefined,
          name: "Smith, Bob",
          timezone: "Europe/London",
          title: "",
          workingHoursEnd: 16,
          workingHoursStart: 8,
        },
        rawTimezone: "Europe/London",
      },
    ]);
  });

  it("reads tab-separated rows without a header by position and defaults missing hours", () => {
    const [row] = parseCSV("Carol Kim\tAsia/Tokyo\tDesigner");

    expect(row?.errors).toStrictEqual([]);
    expect(row?.member).toMatchObject({
      name: "Carol Kim",
      timezone: "Asia/Tokyo",
      workingHoursEnd: 17,
      workingHoursStart: 9,
    });
  });

  it("reports every problem on an invalid row and keeps the valid ones", () => {
    const rows = parseCSV(
      [
        "name,timezone,title,work_start,work_end",
        ",Mars/Olympus,,24,",
        "Dan,Asia/Tokyo,,9,17",
      ].join("\n"),
    );

    expect(rows.map((row) => row.errors)).toStrictEqual([
      [
        "Name is required",
        'Unknown timezone: "Mars/Olympus"',
        "Working hours end must be a whole hour from 0 to 23",
        "Working hours start must be a whole hour from 0 to 23",
      ],
      [],
    ]);
  });

  it("reports a missing timezone", () => {
    const [row] = parseCSV("name,timezone\nEve,");

    expect(row?.errors).toStrictEqual(["Timezone is required"]);
  });

  it("rejects a 101-character title with a row error", () => {
    const [row] = parseCSV(`name,timezone,title\nFrank,Asia/Tokyo,${"a".repeat(101)}`);

    expect(row?.errors).toStrictEqual(["Title must be 100 characters or less"]);
  });
});
