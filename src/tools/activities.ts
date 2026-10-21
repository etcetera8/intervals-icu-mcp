import { z } from "zod";
import { get, put, postFile, athleteId, withErrorHandling } from "../client.js";
import { isoDate, jsonResult, pick } from "../utils.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ACTIVITY_LIST_KEYS = [
  "id",
  "start_date_local",
  "type",
  "name",
  "distance",
  "moving_time",
  "icu_training_load",
  "icu_intensity",
  "icu_ctl",
  "icu_atl",
  "average_heartrate",
  "max_heartrate",
  "icu_average_watts",
  "icu_weighted_avg_watts",
  "perceived_exertion",
  "feel",
  "race",
  "commute",
  "trainer",
] as const;

export async function listActivities(params: {
  oldest?: string;
  newest?: string;
  limit?: number;
  full?: boolean;
}) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const data = await get(`/athlete/${athleteId()}/activities`, {
    oldest: params.oldest ?? isoDate(thirtyDaysAgo),
    newest: params.newest ?? isoDate(today),
    limit: params.limit ?? 20,
  });
  // Raw activities are ~250 lines each; use get_activity for the full record of one.
  if (params.full || !Array.isArray(data)) return jsonResult(data);
  return jsonResult(data.map((a) => pick(a as Record<string, unknown>, ACTIVITY_LIST_KEYS)));
}

export async function getActivity(params: { activityId: string }) {
  const data = await get(`/activity/${params.activityId}`);
  return jsonResult(data);
}

export async function createActivity(params: {
  filePath: string;
  name?: string;
  description?: string;
  startDateLocal?: string;
  type?: string;
}) {
  const fields: Record<string, string> = {};
  if (params.name) fields.name = params.name;
  if (params.description) fields.description = params.description;
  if (params.startDateLocal) fields.start_date_local = params.startDateLocal;
  if (params.type) fields.type = params.type;

  const data = await postFile(`/athlete/${athleteId()}/activities`, params.filePath, fields);
  return jsonResult(data);
}

export async function updateActivity(params: {
  activityId: string;
  name?: string;
  description?: string;
  type?: string;
  startDateLocal?: string;
}) {
  const body: Record<string, string> = {};
  if (params.name) body.name = params.name;
  if (params.description) body.description = params.description;
  if (params.type) body.type = params.type;
  if (params.startDateLocal) body.start_date_local = params.startDateLocal;

  const data = await put(`/activity/${params.activityId}`, body);
  return jsonResult(data);
}

export function registerActivityTools(server: McpServer) {
  server.registerTool(
    "list_activities",
    {
      description:
        "List recent activities. Returns compact summaries (id, name, date, sport, distance, duration, load, intensity, avg/max HR, avg/normalized power, RPE); pass full=true for the raw records, or use get_activity for one activity in detail.",
      inputSchema: {
        oldest: z.string().optional().describe("Start date (YYYY-MM-DD). Defaults to 30 days ago."),
        newest: z.string().optional().describe("End date (YYYY-MM-DD). Defaults to today."),
        limit: z.number().int().min(1).max(200).default(20).describe("Max number of activities to return."),
        full: z.boolean().optional().describe("Return the raw API records instead of the compact view."),
      },
    },
    withErrorHandling(listActivities)
  );

  server.registerTool(
    "get_activity",
    {
      description: "Get full details for a single activity by ID, including power, HR, pace, laps, and intervals.",
      inputSchema: {
        activityId: z.string().describe("The activity ID (e.g. from list_activities)."),
      },
    },
    withErrorHandling(getActivity)
  );

  server.registerTool(
    "create_activity",
    {
      description: "Upload a new activity from a .fit, .tcx, or .gpx file on disk.",
      inputSchema: {
        filePath: z.string().describe("Absolute path to the .fit, .tcx, or .gpx file to upload."),
        name: z.string().optional().describe("Override the activity name."),
        description: z.string().optional().describe("Activity description."),
        startDateLocal: z.string().optional().describe("Start date/time in local time (ISO 8601)."),
        type: z.string().optional().describe("Activity type (e.g. Ride, Run, Swim)."),
      },
    },
    withErrorHandling(createActivity)
  );

  server.registerTool(
    "update_activity",
    {
      description: "Update metadata for an existing activity (name, description, sport type, etc.).",
      inputSchema: {
        activityId: z.string().describe("The activity ID to update."),
        name: z.string().optional().describe("New activity name."),
        description: z.string().optional().describe("New description."),
        type: z.string().optional().describe("Sport type (e.g. Ride, Run, Swim)."),
        startDateLocal: z.string().optional().describe("New start date/time in local time (ISO 8601)."),
      },
    },
    withErrorHandling(updateActivity)
  );
}
