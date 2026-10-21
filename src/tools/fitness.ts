import { z } from "zod";
import { get, athleteId, withErrorHandling } from "../client.js";
import { dropNulls, jsonResult, localIsoDate, pick, round1 } from "../utils.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const DEFAULT_DAYS_BACK = 28;

// Wellness fields worth keeping when populated (Garmin sync and manual entries).
const WELLNESS_KEYS = [
  "weight",
  "restingHR",
  "hrv",
  "hrvSDNN",
  "sleepSecs",
  "sleepScore",
  "sleepQuality",
  "avgSleepingHR",
  "soreness",
  "fatigue",
  "stress",
  "mood",
  "motivation",
  "injury",
  "readiness",
  "vo2max",
  "steps",
  "comments",
] as const;

// One day of the raw wellness record is ~60 lines, mostly nulls. Reduce it to
// fitness/fatigue/form plus whatever wellness values are actually present.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function compactDay(d: Record<string, any>) {
  const ctl = typeof d.ctl === "number" ? d.ctl : undefined;
  const atl = typeof d.atl === "number" ? d.atl : undefined;
  const ride = Array.isArray(d.sportInfo)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? d.sportInfo.find((s: any) => s?.type === "Ride")
    : undefined;

  return dropNulls({
    id: d.id,
    ctl: ctl === undefined ? undefined : round1(ctl),
    atl: atl === undefined ? undefined : round1(atl),
    tsb: ctl === undefined || atl === undefined ? undefined : round1(ctl - atl),
    rampRate: typeof d.rampRate === "number" ? round1(d.rampRate) : undefined,
    load: d.ctlLoad,
    eftp: typeof ride?.eftp === "number" ? Math.round(ride.eftp) : undefined,
    ...pick(d, WELLNESS_KEYS),
  });
}

export async function getFitnessSummary(params: {
  oldest?: string;
  newest?: string;
  full?: boolean;
}) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - DEFAULT_DAYS_BACK);

  const data = await get(`/athlete/${athleteId()}/wellness`, {
    oldest: params.oldest ?? localIsoDate(start),
    newest: params.newest ?? localIsoDate(today),
  });
  if (params.full || !Array.isArray(data)) return jsonResult(data);
  return jsonResult(data.map(compactDay));
}

export function registerFitnessTools(server: McpServer) {
  server.registerTool(
    "get_fitness_summary",
    {
      description:
        "Get daily fitness (CTL), fatigue (ATL), form (TSB = CTL - ATL), ramp rate, daily load and eFTP, plus any wellness data present (resting HR, HRV, sleep, soreness, fatigue, mood...). Defaults to the last 28 days through today; pass explicit dates to look further back or ahead (future days are projections). Compact by default; pass full=true for the raw records.",
      inputSchema: {
        oldest: z
          .string()
          .optional()
          .describe("Start date (YYYY-MM-DD). Defaults to 28 days ago."),
        newest: z
          .string()
          .optional()
          .describe("End date (YYYY-MM-DD). Defaults to today."),
        full: z.boolean().optional().describe("Return the raw API records instead of the compact view."),
      },
    },
    withErrorHandling(getFitnessSummary)
  );
}
