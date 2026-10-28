package com.dacs.fashion.ai.agent;

import com.dacs.fashion.ai.tool.CheckoutTool;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/** Server-owned conversation state. Access is serialized by AgentChatbotService. */
@Getter
@Setter
public class AgentContext {
    private final List<Long> lastProductIds = new ArrayList<>();
    private final List<Long> lastVariantIds = new ArrayList<>();
    private final List<Long> lastCartItemIds = new ArrayList<>();
    private AgentPlan lastSearchRequest;
    private String lastIntent;
    private Long selectedProductId;
    private Long selectedVariantId;
    private Long selectedCartItemId;
    private Long selectedOrderId;
    private String selectedColor;
    private String selectedSize;
    private Integer selectedQuantity = 1;
    private String selectedVoucher;
    private Integer selectedAddressId;
    private String selectedPaymentMethod;
    private boolean pendingCartAdd;
    private boolean checkoutStarted;
    private String pendingAction;
    private String confirmationToken;
    private long confirmationCreatedAt;
    private CheckoutTool.Quote pendingQuote;
    private Long pendingOrderId;
    private String pendingCartSnapshot;
    private long updatedAt = System.currentTimeMillis();

    public boolean getPendingCartAdd() { return pendingCartAdd; }
    public void touch() { updatedAt = System.currentTimeMillis(); }
    public void clearProducts() { lastProductIds.clear(); lastVariantIds.clear(); touch(); }
    public void clearCart() { lastCartItemIds.clear(); selectedCartItemId = null; touch(); }
    public void clearConfirmation() {
        pendingAction = null;
        confirmationToken = null;
        confirmationCreatedAt = 0;
        pendingQuote = null;
        pendingOrderId = null;
        pendingCartSnapshot = null;
    }
    public void selectProduct(Long productId) {
        if (!java.util.Objects.equals(selectedProductId, productId)) {
            selectedProductId = productId;
            selectedVariantId = null;
            selectedColor = null;
            selectedSize = null;
            selectedQuantity = 1;
            pendingCartAdd = false;
        }
    }
}
