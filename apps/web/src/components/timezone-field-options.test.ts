import { describe, expect, it } from "vitest";

import { matchesTimezoneQuery, TIMEZONE_ITEMS } from "./timezone-field-options";

const search = (query: string) =>
  TIMEZONE_ITEMS.filter((timezone) => matchesTimezoneQuery(timezone, query));

describe("matchesTimezoneQuery", () => {
  it("finds a city without its accents", () => {
    expect(search("sao")).toContain("America/Sao_Paulo");
    expect(search("São Paulo")).toStrictEqual(["America/Sao_Paulo"]);
  });

  it("finds a zone by its UTC offset in any common spelling", () => {
    for (const query of ["UTC+5:30", "utc +5:30", "GMT+05:30", "+0530"]) {
      expect(search(query)).toStrictEqual(["Asia/Kolkata"]);
    }
  });

  it("reads a typographic minus as a hyphen", () => {
    expect(search("UTC−3")).toStrictEqual(["America/Sao_Paulo", "America/Argentina/Buenos_Aires"]);
  });

  it("finds a zone by region or generic zone name", () => {
    expect(search("Kolkata")).toStrictEqual(["Asia/Kolkata"]);
    expect(search("india")).toStrictEqual(["Asia/Kolkata"]);
    expect(search("australia")).toStrictEqual(
      expect.arrayContaining(["Australia/Sydney", "Australia/Perth"]),
    );
  });

  it("treats an empty query as a match and an unknown one as a miss", () => {
    expect(search("")).toHaveLength(TIMEZONE_ITEMS.length);
    expect(search("atlantis")).toStrictEqual([]);
  });
});
