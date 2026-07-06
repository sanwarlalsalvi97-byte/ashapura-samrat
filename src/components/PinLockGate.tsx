import { useEffect, useState } from "react";
import { isPinEnabled, isUnlocked, verifyPin } from "@/lib/pin-lock";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export default function PinLockGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(() => !isPinEnabled() || isUnlocked());
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && isPinEnabled() && !isUnlocked()) setOk(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (ok) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (await verifyPin(pin)) { setOk(true); setPin(""); }
    else setErr("गलत PIN / Wrong PIN");
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-xs space-y-4 bg-card border border-border rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 grid place-items-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-lg font-bold">ऐप लॉक / App Locked</h1>
          <p className="text-xs text-muted-foreground text-center">PIN दर्ज करें / Enter your PIN</p>
        </div>
        <Input
          autoFocus
          type="password"
          inputMode="numeric"
          pattern="\d*"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="text-center text-lg tracking-[0.4em]"
          placeholder="••••"
        />
        {err && <p className="text-xs text-destructive text-center">{err}</p>}
        <Button type="submit" className="w-full" disabled={pin.length < 4}>Unlock</Button>
      </form>
    </div>
  );
}
