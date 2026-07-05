import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_attendance",
  title: "Get attendance",
  description: "Get attendance records for a date range (YYYY-MM-DD). Optionally filter by worker_id.",
  inputSchema: {
    from_date: z.string().describe("Start date, inclusive. Format YYYY-MM-DD."),
    to_date: z.string().describe("End date, inclusive. Format YYYY-MM-DD."),
    worker_id: z.string().optional().describe("Optional worker UUID to filter."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ from_date, to_date, worker_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("attendance")
      .select("id, worker_id, date, status, overtime_hours, site_name, notes")
      .gte("date", from_date)
      .lte("date", to_date)
      .order("date", { ascending: false });
    if (worker_id) q = q.eq("worker_id", worker_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { attendance: data ?? [] },
    };
  },
});
