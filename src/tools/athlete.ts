import { z } from "zod";
import { get, athleteId, withErrorHandling } from "../client.js";
import { jsonResult, pick } from "../utils.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ATHLETE_KEYS = [
  "id",
  "name",
  "timezone",
  "measurement_preference",
  "icu_weight",
  "icu_resting_hr",
  "icu_garmin_sync_activities",
  "icu_garmin_upload_workouts",
  "icu_garmin_download_wellness",
  "plan",
] as const;

const SPORT_KEYS = [
  "id",
  "types",
  "ftp",
  "indoor_ftp",
  "lthr",
  "max_hr",
  "power_zones",
  "hr_zones",
  "threshold_pace",
  "pace_units",
  "pace_zones",
] as const;

const MMP_KEYS = ["criticalPower", "wPrime", "pMax", "ftp"] as const;

// The raw profile is several hundred lines and includes contact details, invite
// tokens, notification settings and chart configs. Keep what a coach needs:
// identity, timezone, Garmin sync flags and per-sport thresholds/zones.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function compactAthlete(a: Record<string, any>) {
  const out = pick(a, ATHLETE_KEYS);
  if (Array.isArray(a.sportSettings)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    out.sportSettings = a.sportSettings.map((s: Record<string, any>) => {
      const c = pick(s, SPORT_KEYS);
      if (s.mmp_model && typeof s.mmp_model === "object") c.mmp_model = pick(s.mmp_model, MMP_KEYS);
      return c;
    });
  }
  return out;
}

export async function getAthlete(params: { full?: boolean } = {}) {
  const data = await get<Record<string, unknown>>(`/athlete/${athleteId()}`);
  if (params?.full || !data || typeof data !== "object") return jsonResult(data);
  return jsonResult(compactAthlete(data));
}

export function registerAthleteTools(server: McpServer) {
  server.registerTool(
    "get_athlete",
    {
      description:
        "Get the athlete profile: timezone, Garmin sync flags, and per-sport thresholds (FTP, LTHR, max HR) and zones. Compact by default; pass full=true for the raw profile (several hundred lines).",
      inputSchema: {
        full: z.boolean().optional().describe("Return the raw API response instead of the compact view."),
      },
    },
    withErrorHandling(getAthlete)
  );
}
