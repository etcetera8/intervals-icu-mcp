import { z } from "zod";
import { get, post, put, athleteId, withErrorHandling } from "../client.js";
import { jsonResult, localIsoDate, pick, toLocalDateTime } from "../utils.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const EVENT_CATEGORIES = [
  "WORKOUT",
  "RACE_A",
  "RACE_B",
  "RACE_C",
  "NOTE",
  "HOLIDAY",
  "SICK",
  "INJURED",
] as const;

const EVENT_KEYS = [
  "id",
  "start_date_local",
  "name",
  "category",
  "type",
  "indoor",
  "moving_time",
  "distance",
  "icu_training_load",
  "icu_intensity",
  "description",
  "push_errors",
] as const;

// Raw events carry a large workout_doc (zone tables, strain score, etc.). Keep the
// steps and headline numbers, which is what's needed to confirm what was scheduled.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function compactEvent(e: any) {
  if (!e || typeof e !== "object") return e;
  const out = pick(e, EVENT_KEYS);
  if (e.workout_doc && typeof e.workout_doc === "object") {
    out.workout_doc = pick(e.workout_doc, [
      "steps",
      "duration",
      "average_watts",
      "normalized_power",
    ]);
  }
  return out;
}

export async function listEvents(params: { oldest: string; newest: string; full?: boolean }) {
  const data = await get(`/athlete/${athleteId()}/events`, {
    oldest: params.oldest,
    newest: params.newest,
  });
  if (params.full || !Array.isArray(data)) return jsonResult(data);
  return jsonResult(data.map(compactEvent));
}

export async function createEvent(params: {
  startDateLocal?: string;
  name?: string;
  category?: (typeof EVENT_CATEGORIES)[number];
  type?: string;
  description?: string;
  movingTime?: number;
  distance?: number;
  indoor?: boolean;
}) {
  const body: Record<string, unknown> = {
    start_date_local: toLocalDateTime(params.startDateLocal ?? localIsoDate(new Date())),
    category: params.category ?? "WORKOUT",
    indoor: params.indoor ?? false,
  };
  if (params.name !== undefined) body.name = params.name;
  if (params.type !== undefined) body.type = params.type;
  if (params.description !== undefined) body.description = params.description;
  if (params.movingTime !== undefined) body.moving_time = params.movingTime;
  if (params.distance !== undefined) body.distance = params.distance;

  const data = await post(`/athlete/${athleteId()}/events`, body);
  return jsonResult(compactEvent(data));
}

export async function updateEvent(params: {
  eventId: number;
  startDateLocal?: string;
  name?: string;
  category?: (typeof EVENT_CATEGORIES)[number];
  type?: string;
  description?: string;
  movingTime?: number;
  distance?: number;
  indoor?: boolean;
}) {
  const body: Record<string, unknown> = {};
  if (params.startDateLocal !== undefined) body.start_date_local = toLocalDateTime(params.startDateLocal);
  if (params.name !== undefined) body.name = params.name;
  if (params.category !== undefined) body.category = params.category;
  if (params.type !== undefined) body.type = params.type;
  if (params.description !== undefined) body.description = params.description;
  if (params.movingTime !== undefined) body.moving_time = params.movingTime;
  if (params.distance !== undefined) body.distance = params.distance;
  if (params.indoor !== undefined) body.indoor = params.indoor;

  const data = await put(`/athlete/${athleteId()}/events/${params.eventId}`, body);
  return jsonResult(compactEvent(data));
}

export function registerCalendarTools(server: McpServer) {
  server.registerTool(
    "list_events",
    {
      description:
        "List planned workouts and calendar events in a date range. Returns a compact view (name, date, load, description, workout steps); pass full=true for the raw API payload.",
      inputSchema: {
        oldest: z.string().describe("Start date (YYYY-MM-DD)."),
        newest: z.string().describe("End date (YYYY-MM-DD)."),
        full: z.boolean().optional().describe("Return the raw API response instead of the compact view."),
      },
    },
    withErrorHandling(listEvents)
  );

  server.registerTool(
    "create_event",
    {
      description: "Add a planned workout or event to the training calendar.",
      inputSchema: {
        startDateLocal: z
          .string()
          .optional()
          .describe("Event date (YYYY-MM-DD) or local datetime (YYYY-MM-DDTHH:mm:ss). A bare date is treated as local midnight. Defaults to today."),
        name: z.string().optional().describe("Event title."),
        category: z
          .enum(EVENT_CATEGORIES)
          .optional()
          .describe("Event category. Defaults to WORKOUT."),
        type: z.string().optional().describe("Sport type (e.g. Ride, Run, Swim)."),
        description: z.string().optional().describe("Workout description or notes."),
        movingTime: z.number().int().positive().optional().describe("Planned duration in seconds."),
        distance: z.number().int().positive().optional().describe("Planned distance in meters."),
        indoor: z.boolean().default(false).describe("Whether the workout is indoors."),
      },
    },
    withErrorHandling(createEvent)
  );

  server.registerTool(
    "update_event",
    {
      description: "Update an existing calendar event by ID.",
      inputSchema: {
        eventId: z.number().int().describe("The event ID to update."),
        startDateLocal: z
          .string()
          .optional()
          .describe("New event date (YYYY-MM-DD) or local datetime (YYYY-MM-DDTHH:mm:ss)."),
        name: z.string().optional().describe("New event title."),
        category: z.enum(EVENT_CATEGORIES).optional().describe("New event category."),
        type: z.string().optional().describe("New sport type (e.g. Ride, Run, Swim)."),
        description: z.string().optional().describe("New workout description or notes."),
        movingTime: z.number().int().positive().optional().describe("New planned duration in seconds."),
        distance: z.number().int().positive().optional().describe("New planned distance in meters."),
        indoor: z.boolean().optional().describe("Whether the workout is indoors."),
      },
    },
    withErrorHandling(updateEvent)
  );
}
