package com.ashapura.samrat;

import androidx.annotation.NonNull;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.collect.ImmutableList;

import java.util.ArrayList;
import java.util.List;

/** Native Google Play Billing bridge for subscription products and base plans. */
@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin {
    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;
    private String pendingProductId;

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this::onPurchasesUpdated)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
            )
            .build();
    }

    private void withConnectedClient(PluginCall call, Runnable action) {
        if (billingClient == null) {
            call.reject("Google Play Billing उपलब्ध नहीं है।");
            return;
        }
        if (billingClient.isReady()) {
            action.run();
            return;
        }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    action.run();
                } else {
                    call.reject(playMessage(result), String.valueOf(result.getResponseCode()));
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // A later button tap reconnects through this same method.
            }
        });
    }

    @PluginMethod
    public void purchaseSubscription(PluginCall call) {
        String productWithBasePlan = call.getString("productId");
        if (productWithBasePlan == null || productWithBasePlan.trim().isEmpty()) {
            call.reject("प्लान ID नहीं मिली।");
            return;
        }
        if (pendingPurchaseCall != null) {
            call.reject("एक भुगतान पहले से चल रहा है।");
            return;
        }

        String[] parts = productWithBasePlan.split(":", 2);
        String productId = parts[0];
        String basePlanId = parts.length > 1 ? parts[1] : null;

        withConnectedClient(call, () -> queryAndLaunchSubscription(call, productId, basePlanId));
    }

    private void queryAndLaunchSubscription(PluginCall call, String productId, String basePlanId) {
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(productId)
            .setProductType(BillingClient.ProductType.SUBS)
            .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(ImmutableList.of(product))
            .build();

        billingClient.queryProductDetailsAsync(params, (result, detailsResult) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                call.reject(playMessage(result), String.valueOf(result.getResponseCode()));
                return;
            }
            List<ProductDetails> products = detailsResult.getProductDetailsList();
            if (products == null || products.isEmpty()) {
                call.reject("यह प्लान Google Play पर उपलब्ध नहीं है।");
                return;
            }

            ProductDetails details = products.get(0);
            List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
            ProductDetails.SubscriptionOfferDetails selectedOffer = null;
            if (offers != null) {
                for (ProductDetails.SubscriptionOfferDetails offer : offers) {
                    if (basePlanId == null || basePlanId.equals(offer.getBasePlanId())) {
                        selectedOffer = offer;
                        break;
                    }
                }
            }
            if (selectedOffer == null) {
                call.reject("चुना हुआ मासिक/वार्षिक प्लान Google Play पर उपलब्ध नहीं है।");
                return;
            }

            BillingFlowParams.ProductDetailsParams productParams =
                BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details)
                    .setOfferToken(selectedOffer.getOfferToken())
                    .build();
            BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(ImmutableList.of(productParams))
                .build();

            pendingPurchaseCall = call;
            pendingProductId = productId;
            BillingResult launchResult = billingClient.launchBillingFlow(getActivity(), flowParams);
            if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                clearPendingPurchase();
                call.reject(playMessage(launchResult), String.valueOf(launchResult.getResponseCode()));
            }
        });
    }

    private void onPurchasesUpdated(BillingResult result, List<com.android.billingclient.api.Purchase> purchases) {
        PluginCall call = pendingPurchaseCall;
        if (call == null) return;

        if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            clearPendingPurchase();
            call.reject("भुगतान रद्द किया गया।", "USER_CANCELLED");
            return;
        }
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
            clearPendingPurchase();
            call.reject(playMessage(result), String.valueOf(result.getResponseCode()));
            return;
        }

        com.android.billingclient.api.Purchase purchase = purchases.get(0);
        if (purchase.getPurchaseState() == com.android.billingclient.api.Purchase.PurchaseState.PENDING) {
            clearPendingPurchase();
            call.reject("भुगतान लंबित है। Google Play पुष्टि के बाद सदस्यता सक्रिय होगी।", "PURCHASE_PENDING");
            return;
        }
        if (purchase.getPurchaseState() != com.android.billingclient.api.Purchase.PurchaseState.PURCHASED) {
            clearPendingPurchase();
            call.reject("Google Play भुगतान पूरा नहीं हुआ।");
            return;
        }

        resolvePurchase(call, purchase);
    }

    private void resolvePurchase(PluginCall call, com.android.billingclient.api.Purchase purchase) {
        JSObject response = new JSObject();
        response.put("productId", pendingProductId);
        response.put("purchaseToken", purchase.getPurchaseToken());
        response.put("orderId", purchase.getOrderId());
        response.put("acknowledged", purchase.isAcknowledged());
        clearPendingPurchase();
        call.resolve(response);
    }

    @PluginMethod
    public void restoreSubscriptions(PluginCall call) {
        withConnectedClient(call, () -> {
            QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build();
            billingClient.queryPurchasesAsync(params, (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject(playMessage(result), String.valueOf(result.getResponseCode()));
                    return;
                }
                JSArray restored = new JSArray();
                for (com.android.billingclient.api.Purchase purchase : purchases) {
                    if (purchase.getPurchaseState() != com.android.billingclient.api.Purchase.PurchaseState.PURCHASED) continue;
                    for (String productId : purchase.getProducts()) {
                        JSObject item = new JSObject();
                        item.put("productId", productId);
                        item.put("purchaseToken", purchase.getPurchaseToken());
                        restored.put(item);
                    }
                }
                JSObject response = new JSObject();
                response.put("purchases", restored);
                call.resolve(response);
            });
        });
    }

    private String playMessage(BillingResult result) {
        String detail = result.getDebugMessage();
        return detail == null || detail.isEmpty()
            ? "Google Play भुगतान सेवा उपलब्ध नहीं है।"
            : "Google Play: " + detail;
    }

    private void clearPendingPurchase() {
        pendingPurchaseCall = null;
        pendingProductId = null;
    }

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null) billingClient.endConnection();
        super.handleOnDestroy();
    }
}