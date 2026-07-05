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
  name: "get_cashbook",
  title: "Get cashbook entries",
  description: "List cashbook (income/expense) entries within a date range.",
  inputSchema: {
    from_date: z.string().describe("Start date YYYY-MM-DD."),
    to_date: z.string().describe("End date YYYY-MM-DD."),
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ from_date, to_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("cashbook")
      .select("*")
      .gte("date", from_date)
      .lte("date", to_date)
      .order("date", { ascending: false })
      .limit(limit ?? 100);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    let income = 0, expense = 0;
    for (const row of data ?? []) {
      const amt = Number((row as any).amount ?? 0);
      if ((row as any).type === "income") income += amt;
      else expense += amt;
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ income, expense, balance: income - expense, entries: data }) }],
      structuredContent: { income, expense, balance: income - expense, entries: data ?? [] },
    };
  },
});
