import { useEffect, useState } from "react";
import { flushQueue, getQueueCount, isOnline, subscribeQueue } from "@/lib/offline-queue";
import { toast } from "@/hooks/use-toast";

/**
 * Watches network state + offline queue.
 * - Auto-flushes when the browser comes back online.
 * - Returns { online, pending } for UI indicators.
 */
export function useOfflineSync() {
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(getQueueCount());

  useEffect(() => {
    const refresh = () => {
      setPending(getQueueCount());
      setOnline(isOnline());
    };
    const unsub = subscribeQueue(refresh);

    const tryFlush = async () => {
      if (!isOnline()) return;
      const before = getQueueCount();
      if (before === 0) return;
      const { ok, failed } = await flushQueue();
      if (ok > 0) {
        toast({
          title: "ऑफलाइन हाजिरी सिंक हो गई",
          description: `${ok} एंट्री सर्वर पर भेजी गई${failed > 0 ? `, ${failed} बाकी` : ""}`,
        });
      }
    };

    const handleOnline = () => {
      setOnline(isOnline());
      tryFlush();
    };
    const handleOffline = () => setOnline(isOnline());

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // On mount: if already online and queue has items, flush.
    tryFlush();

    // Periodic retry every 30s in case the 'online' event was missed.
    const interval = window.setInterval(() => {
      if (isOnline() && getQueueCount() > 0) tryFlush();
    }, 30_000);

    return () => {
      unsub();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(interval);
    };
  }, []);

  return { online, pending };
}
