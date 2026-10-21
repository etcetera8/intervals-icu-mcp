import { describe, it, expect } from "vitest";
import { isoDate, jsonResult, localIsoDate, toLocalDateTime, pick, dropNulls, round1 } from "../utils.js";

describe("isoDate", () => {
  it("formats a UTC date as YYYY-MM-DD", () => {
    expect(isoDate(new Date("2024-06-30T12:00:00.000Z"))).toBe("2024-06-30");
  });

  it("zero-pads single-digit month and day", () => {
    expect(isoDate(new Date("2024-01-05T00:00:00.000Z"))).toBe("2024-01-05");
  });
});

describe("jsonResult", () => {
  it("wraps an object in MCP text content shape", () => {
    const data = { id: 1, name: "test" };
    const result = jsonResult(data);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual(data);
  });

  it("wraps an array correctly", () => {
    const data = [1, 2, 3];
    const result = jsonResult(data);
    expect(JSON.parse(result.content[0].text)).toEqual(data);
  });

  it("does not set isError on success results", () => {
    const result = jsonResult({});
    expect(result.isError).toBeUndefined();
  });

  it("pretty-prints the JSON", () => {
    const result = jsonResult({ a: 1 });
    expect(result.content[0].text).toContain("\n");
  });
});

describe("localIsoDate", () => {
  it("formats using local calendar fields, zero-padded", () => {
    expect(localIsoDate(new Date(2024, 0, 5, 23, 30))).toBe("2024-01-05");
    expect(localIsoDate(new Date(2024, 11, 31, 0, 5))).toBe("2024-12-31");
  });
});

describe("toLocalDateTime", () => {
  it("promotes a bare date to local midnight", () => {
    expect(toLocalDateTime("2026-10-22")).toBe("2026-10-22T00:00:00");
  });

  it("leaves datetimes unchanged", () => {
    expect(toLocalDateTime("2026-10-22T06:30:00")).toBe("2026-10-22T06:30:00");
    expect(toLocalDateTime("2026-10-22T06:30")).toBe("2026-10-22T06:30");
  });
});

describe("dropNulls / pick / round1", () => {
  it("dropNulls removes null and undefined but keeps 0 and false", () => {
    expect(dropNulls({ a: 1, b: null, c: undefined, d: 0, e: false })).toEqual({ a: 1, d: 0, e: false });
  });

  it("pick keeps only the listed, non-null keys", () => {
    expect(pick({ a: 1, b: 2, c: null }, ["a", "c", "z"])).toEqual({ a: 1 });
  });

  it("round1 rounds to one decimal", () => {
    expect(round1(79.28885)).toBe(79.3);
    expect(round1(-6.899999)).toBe(-6.9);
  });
});
