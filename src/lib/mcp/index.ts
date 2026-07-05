import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listWorkersTool from "./tools/list-workers";
import getAttendanceTool from "./tools/get-attendance";
import getCashbookTool from "./tools/get-cashbook";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "ashapura-samrat-mcp",
  title: "Ashapura Samrat MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Ashapura Samrat construction management app. Read workers, attendance, and cashbook entries for the signed-in user. Dates are YYYY-MM-DD in Asia/Kolkata.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listWorkersTool, getAttendanceTool, getCashbookTool],
});
