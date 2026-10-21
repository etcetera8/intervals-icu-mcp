import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAthlete, compactAthlete } from "../tools/athlete.js";

vi.mock("../client.js", () => ({
  athleteId: () => "0",
  get: vi.fn(),
  put: vi.fn(),
  postFile: vi.fn(),
}));

import * as client from "../client.js";

describe("get_athlete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls GET /athlete/0 and returns the raw JSON text when full=true", async () => {
    const mockAthlete = { id: "i12345", name: "Jane Athlete", country: "US" };
    vi.mocked(client.get).mockResolvedValue(mockAthlete);

    const result = await getAthlete({ full: true });

    expect(client.get).toHaveBeenCalledWith("/athlete/0");
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual(mockAthlete);
  });

  it("propagates errors from the API client", async () => {
    vi.mocked(client.get).mockRejectedValue(new Error("401 Unauthorized"));

    await expect(getAthlete()).rejects.toThrow("401 Unauthorized");
  });
});

describe("compactAthlete", () => {
  const raw = {
    id: "i12345",
    name: "Jane Athlete",
    email: "jane@example.com",
    icu_friend_invite_token: "secret-token",
    timezone: "America/Los_Angeles",
    icu_garmin_upload_workouts: true,
    icu_garmin_download_wellness: true,
    custom_items: [{ id: 1, content: { plots: [] } }],
    sportSettings: [
      {
        id: 1,
        types: ["Ride"],
        ftp: 329,
        indoor_ftp: null,
        lthr: 165,
        power_zones: [55, 75, 90, 105, 120, 150],
        display: { color: "#0863b2" },
        mmp_model: { type: "FFT_CURVES", criticalPower: 310, wPrime: 21000, pMax: 1099, ftp: 317, inputPointIndexes: [1] },
      },
    ],
  };

  it("keeps identity, timezone, Garmin flags and per-sport thresholds", () => {
    const out = compactAthlete(raw) as Record<string, any>;
    expect(out.id).toBe("i12345");
    expect(out.timezone).toBe("America/Los_Angeles");
    expect(out.icu_garmin_upload_workouts).toBe(true);
    expect(out.sportSettings[0]).toMatchObject({ ftp: 329, lthr: 165, types: ["Ride"] });
    expect(out.sportSettings[0].mmp_model).toEqual({ criticalPower: 310, wPrime: 21000, pMax: 1099, ftp: 317 });
  });

  it("drops contact details, tokens, nulls and display config", () => {
    const text = JSON.stringify(compactAthlete(raw));
    expect(text).not.toContain("jane@example.com");
    expect(text).not.toContain("secret-token");
    expect(text).not.toContain("custom_items");
    expect(text).not.toContain("indoor_ftp");
    expect(text).not.toContain("display");
  });

  it("is what get_athlete returns by default", async () => {
    vi.mocked(client.get).mockResolvedValue(raw);
    const result = await getAthlete();
    expect(JSON.parse(result.content[0].text)).toEqual(compactAthlete(raw));
  });
});
