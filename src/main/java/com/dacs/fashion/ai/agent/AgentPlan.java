package com.dacs.fashion.ai.agent;

import java.math.BigDecimal;
import java.util.List;
import lombok.Builder;

@Builder(toBuilder = true)
public record AgentPlan(
        String action,
        String productType,
        String audience,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        BigDecimal targetPrice,
        BigDecimal totalBudget,
        String size,
        String color,
        String brand,
        String occasion,
        String style,
        Long productId,
        Long variantId,
        Long cartItemId,
        Long orderId,
        Integer quantity,
        String voucherCode,
        List<Integer> referenceIndexes,
        String reply,
        String keyword,
        String category,
        Boolean sale,
        String sort,
        Boolean stock,
        Integer limit,
        String paymentMethod,
        Integer addressIndex,
        String orderStatus
) {
    public AgentPlan(String action, String productType, String audience, BigDecimal minPrice,
                     BigDecimal maxPrice, BigDecimal targetPrice, BigDecimal totalBudget,
                     String size, String color, String brand, String occasion, String style,
                     Long productId, Long variantId, Long cartItemId, Long orderId, Integer quantity,
                     String voucherCode, List<Integer> referenceIndexes, String reply) {
        this(action, productType, audience, minPrice, maxPrice, targetPrice, totalBudget,
                size, color, brand, occasion, style, productId, variantId, cartItemId, orderId,
                quantity, voucherCode, referenceIndexes, reply, null, null, null, null, null,
                null, null, null, null);
    }
}
