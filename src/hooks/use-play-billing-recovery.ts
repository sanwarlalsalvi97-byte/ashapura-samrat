import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { PlayBilling } from "@/lib/play-billing";
import { restorePlaySubscriptions } from "@/lib/subscription-billing";

export function usePlayBillingRecovery(userId?: string) {
  useEffect(() => {
    if (!userId || Capacitor.getPlatform() !== "android") return;
    let disposed = false;
    const recover = () => {
      if (disposed) return;
      void restorePlaySubscriptions().catch(() => {
        // Leave purchases in Google Play for the next launch/resume or manual retry.
        console.warn("Subscription recovery deferred; retry on next resume.");
      });
    };
    const appListener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) recover();
    });
    const purchaseListener = PlayBilling.addListener("purchasesUpdated", recover);
    recover();
    return () => {
      disposed = true;
      void appListener.then((listener) => listener.remove());
      void purchaseListener.then((listener) => listener.remove());
    };
  }, [userId]);
}