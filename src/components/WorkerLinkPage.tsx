import { useState } from "react";
import { IdCard, Smartphone, Link2, LogOut, Loader2 } from "lucide-react";
import { linkWorkerAccount } from "@/lib/worker-link";
import { supabase } from "@/integrations/supabase/client";

export default function WorkerLinkPage({ onLinked }: { onLinked: () => void }) {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await linkWorkerAccount(code, phone);
    setBusy(false);
    if (res.ok) onLinked();
    else setError(res.message);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 grid place-items-center">
            <Link2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">अपना खाता जोड़ें</h1>
          <p className="text-sm text-muted-foreground">
            ठेकेदार से मिला 4-अंकों का मजदूर कोड और अपना रजिस्टर्ड मोबाइल नंबर डालें।
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3 bg-card border border-border rounded-2xl p-4 shadow-sm">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">मजदूर कोड</span>
            <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-background">
              <IdCard className="w-4 h-4 text-muted-foreground" />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="1001"
                className="flex-1 bg-transparent outline-none tracking-[0.3em] font-bold"
                required
              />
            </div>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">मोबाइल नंबर</span>
            <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-background">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 12))}
                inputMode="numeric"
                placeholder="9876543210"
                className="flex-1 bg-transparent outline-none font-semibold"
                required
              />
            </div>
          </label>

          {error && (
            <p className="text-xs font-semibold text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary text-primary-foreground font-bold py-3 active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            खाता जोड़ें
          </button>
        </form>

        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full text-xs font-semibold text-muted-foreground flex items-center justify-center gap-1.5 py-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          लॉग आउट
        </button>
      </div>
    </div>
  );
}
