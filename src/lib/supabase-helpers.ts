import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Worker = Database["public"]["Tables"]["workers"]["Row"];
type WorkerInsert = Database["public"]["Tables"]["workers"]["Insert"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
type AttendanceInsert = Database["public"]["Tables"]["attendance"]["Insert"];
type WorkerRole = Database["public"]["Enums"]["worker_role"];
type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

export type { Worker, WorkerInsert, Attendance, AttendanceInsert, WorkerRole, AttendanceStatus };

export async function getWorkers() {
  const { data, error } = await supabase
    .from("workers")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data;
}

export async function addWorker(worker: Omit<WorkerInsert, "user_id">) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("workers")
    .insert({ ...worker, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWorker(workerId: string) {
  const { error } = await supabase
    .from("workers")
    .update({ is_active: false })
    .eq("id", workerId);
  if (error) throw error;
}

export async function updateWorker(workerId: string, updates: { name: string; role: WorkerRole; daily_rate: number; site_name: string | null; phone: string | null }) {
  const { error } = await supabase
    .from("workers")
    .update(updates)
    .eq("id", workerId);
  if (error) throw error;
}

export async function getAttendanceByDate(date: string) {
  const { data, error } = await supabase
    .from("attendance")
    .select("*, workers(name, role, daily_rate)")
    .eq("date", date);
  if (error) throw error;
  return data;
}

export async function markAttendance(record: Omit<AttendanceInsert, "user_id">) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("attendance")
    .upsert({ ...record, user_id: user.id }, { onConflict: "worker_id,date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMonthlyReport(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];
  
  const { data, error } = await supabase
    .from("attendance")
    .select("*, workers(name, role, daily_rate)")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");
  if (error) throw error;
  return data;
}

export async function deleteWorkerMonthAttendance(workerId: string, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("worker_id", workerId)
    .gte("date", startDate)
    .lte("date", endDate);
  if (error) throw error;
}
