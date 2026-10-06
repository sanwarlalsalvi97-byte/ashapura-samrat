import { registerPlugin } from "@capacitor/core";

export type PlayPurchase = {
  productId: string;
  purchaseToken: string;
  orderId?: string | null;
  acknowledged: boolean;
};

type RestoredPurchases = {
  purchases: Array<Pick<PlayPurchase, "productId" | "purchaseToken">>;
};

interface PlayBillingPlugin {
  purchaseSubscription(options: { productId: string }): Promise<PlayPurchase>;
  acknowledgePurchase(options: { purchaseToken: string }): Promise<void>;
  restoreSubscriptions(): Promise<RestoredPurchases>;
}

export const PlayBilling = registerPlugin<PlayBillingPlugin>("PlayBilling");