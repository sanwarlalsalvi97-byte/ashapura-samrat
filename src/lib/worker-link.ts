import { supabase } from "@/integrations/supabase/client";

export type LinkedWorker = {
  id: string;
  name: string;
  worker_code: string | null;
  phone: string | null;
  site_name: string | null;
  daily_rate: number | null;
};

/** The worker record (created by a contractor) that this login is linked to, if any. */
export async function getLinkedWorker(): Promise<LinkedWorker | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("workers")
    .select("id,name,worker_code,phone,site_name,daily_rate")
    .eq("linked_user_id", user.id)
    .maybeSingle();
  if (error) return null;
  return (data as LinkedWorker) ?? null;
}

export type LinkResult =
  | { ok: true; workerId: string }
  | { ok: false; message: string };

/** Claim a worker record using the 4-digit worker code + registered phone number. */
export async function linkWorkerAccount(workerCode: string, phone: string): Promise<LinkResult> {
  const code = workerCode.replace(/\D/g, "");
  const digits = phone.replace(/\D/g, "");
  if (code.length < 3) return { ok: false, message: "सही 4-अंकों का मजदूर कोड डालें।" };
  if (digits.length < 10) return { ok: false, message: "10 अंकों का मोबाइल नंबर डालें।" };

  const { data, error } = await supabase.rpc("link_worker_account", {
    _worker_code: code,
    _phone: digits,
  });
  if (error) return { ok: false, message: error.message };
  if (!data) {
    return {
      ok: false,
      message: "कोड या मोबाइल नंबर मेल नहीं खाया, या यह कोड पहले से किसी खाते से जुड़ा है। ठेकेदार से सही कोड लें।",
    };
  }
  return { ok: true, workerId: data as string };
}
