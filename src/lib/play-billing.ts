import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type PlayPurchase = {
  productId: string;
  purchaseToken: string;
  orderId?: string | null;
  acknowledged: boolean;
  purchaseState: "PURCHASED" | "PENDING";
};

type RestoredPurchases = {
  purchases: PlayPurchase[];
};

interface PlayBillingPlugin {
  addListener(eventName: "purchasesUpdated", listener: () => void): Promise<PluginListenerHandle>;
  purchaseSubscription(options: { productId: string }): Promise<PlayPurchase>;
  acknowledgePurchase(options: { purchaseToken: string }): Promise<void>;
  restoreSubscriptions(): Promise<RestoredPurchases>;
}

export const PlayBilling = registerPlugin<PlayBillingPlugin>("PlayBilling");