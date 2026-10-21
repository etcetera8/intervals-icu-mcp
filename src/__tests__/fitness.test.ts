import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getFitnessSummary, compactDay } from "../tools/fitness.js";

vi.mock("../client.js", () => ({
  athleteId: () => "0",
  get: vi.fn(),
}));

import * as client from "../client.js";

const FIXED_NOW = new Date("2026-05-11T12:00:00Z");
const FIXED_TODAY = "2026-05-11";
const FIXED_28_DAYS_AGO = "2026-04-13";

describe("get_fitness_summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults oldest to 28 days ago and newest to today", async () => {
    vi.mocked(client.get).mockResolvedValue([]);
    await getFitnessSummary({});
    expect(client.get).toHaveBeenCalledWith("/athlete/0/wellness", {
      oldest: FIXED_28_DAYS_AGO,
      newest: FIXED_TODAY,
    });
  });

  it("passes explicit date params through unchanged", async () => {
    vi.mocked(client.get).mockResolvedValue([]);
    await getFitnessSummary({ oldest: "2026-01-01", newest: "2026-06-30" });
    expect(client.get).toHaveBeenCalledWith("/athlete/0/wellness", {
      oldest: "2026-01-01",
      newest: "2026-06-30",
    });
  });

  it("returns raw wellness records as MCP text content when full=true", async () => {
    const mockWellness = [
      { id: "2026-05-10", ctl: 65.2, atl: 72.1, rampRate: -0.3 },
      { id: "2026-05-11", ctl: 65.8, atl: 70.4, rampRate: 0.2 },
    ];
    vi.mocked(client.get).mockResolvedValue(mockWellness);

    const result = await getFitnessSummary({ full: true });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual(mockWellness);
  });

  it("returns compact days (with form) by default", async () => {
    vi.mocked(client.get).mockResolvedValue([
      { id: "2026-05-10", ctl: 65.2, atl: 72.1, rampRate: -0.3, hrv: null },
    ]);

    const result = await getFitnessSummary({});

    expect(JSON.parse(result.content[0].text)).toEqual([
      { id: "2026-05-10", ctl: 65.2, atl: 72.1, tsb: -6.9, rampRate: -0.3 },
    ]);
  });

  it("propagates errors from the API client", async () => {
    vi.mocked(client.get).mockRejectedValue(new Error("401 Unauthorized"));
    await expect(getFitnessSummary({})).rejects.toThrow("401 Unauthorized");
  });
});

describe("compactDay", () => {
  it("keeps populated wellness values and eFTP, drops nulls", () => {
    const out = compactDay({
      id: "2026-10-21",
      ctl: 79.28885,
      atl: 61.15105,
      rampRate: -3.7867813,
      ctlLoad: 0,
      sportInfo: [{ type: "Ride", eftp: 322.30902, wPrime: 27865, pMax: 1054 }],
      restingHR: 44,
      hrv: 61,
      sleepSecs: 28710,
      sleepScore: 79,
      soreness: null,
      fatigue: null,
      spO2: null,
    });
    expect(out).toEqual({
      id: "2026-10-21",
      ctl: 79.3,
      atl: 61.2,
      tsb: 18.1,
      rampRate: -3.8,
      load: 0,
      eftp: 322,
      restingHR: 44,
      hrv: 61,
      sleepSecs: 28710,
      sleepScore: 79,
    });
  });

  it("omits tsb when ctl or atl is missing", () => {
    expect(compactDay({ id: "2026-10-21", ctl: 70 })).toEqual({ id: "2026-10-21", ctl: 70 });
  });
});
