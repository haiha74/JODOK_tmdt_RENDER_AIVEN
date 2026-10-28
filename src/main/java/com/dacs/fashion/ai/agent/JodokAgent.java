package com.dacs.fashion.ai.agent;

import com.dacs.fashion.ai.groq.GroqClient;
import com.dacs.fashion.ai.tool.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class JodokAgent {
    private static final long TTL_MS = 30 * 60 * 1000L;
    private static final int MAX_CONTEXTS = 2000;
    private final GroqClient groqClient;
    private final ObjectMapper objectMapper;
    private final ProductTool productTool;
    private final CartTool cartTool;
    private final OrderTool orderTool;
    private final VoucherTool voucherTool;
    private final StylistTool stylistTool;
    private final Map<String, AgentContext> contexts = new ConcurrentHashMap<>();
    private final VietnamesePlanParser vietnameseParser = new VietnamesePlanParser();

    public JodokAgent(GroqClient groqClient, ObjectMapper objectMapper, ProductTool productTool,
                      CartTool cartTool, OrderTool orderTool, VoucherTool voucherTool, StylistTool stylistTool) {
        this.groqClient = groqClient; this.objectMapper = objectMapper; this.productTool = productTool;
        this.cartTool = cartTool; this.orderTool = orderTool; this.voucherTool = voucherTool; this.stylistTool = stylistTool;
    }

    public AgentPlan plan(String message, String conversationId, Long userId) throws Exception {
        AgentContext context = context(conversationId);
        ProductTool.CatalogInfo info = productTool.getCatalogInfo();
        AgentPlan local = vietnameseParser.parse(message, context, info);
        if (local != null) { context.touch(); return local; }
        String prompt = """
                Bạn là router/tool planner của JODOK. Hiểu tiếng Việt tự nhiên.
                Chỉ trả JSON object. reply BẮT BUỘC bằng tiếng Việt, kể cả lỗi và hỏi lại.
                action thuộc: GREETING, HELP, PRODUCT_SEARCH, PRODUCT_DETAIL, VARIANT_CHECK,
                PRODUCT_BRANDS, COMPARE, OUTFIT,
                CART_VIEW, CART_ADD, CART_UPDATE, CART_REMOVE, CART_CLEAR,
                VOUCHER_LIST, VOUCHER_CHECK, VOUCHER_APPLY, CHECKOUT_SUMMARY,
                ADDRESS_LIST, ADDRESS_SELECT, PAYMENT_METHODS, PAYMENT_CREATE,
                ORDER_LIST, ORDER_DETAIL, ORDER_STATUS, ORDER_CANCEL, CHAT, ASK_CLARIFICATION, UNKNOWN.
                Tuyệt đối không trả CONFIRM hoặc tự xác nhận đặt/hủy đơn. Backend quản lý xác nhận.
                Với giá: 100k/100 nghìn/100 ngàn = 100000, 1tr/1 triệu = 1000000.
                'áo 100k', 'khoảng 100k' là ưu tiên mềm targetPrice=100000, không đặt minPrice/maxPrice.
                Chỉ đặt minPrice/maxPrice cho giới hạn rõ ràng: dưới, trên, từ...đến...
                productType, audience, brand, color, size, minPrice, maxPrice là bộ lọc bắt buộc khi khách nói rõ.
                Không đổi loại sản phẩm để có kết quả. Không bịa sản phẩm, giá, tồn kho, voucher, đơn hàng.
                Không tự bịa ID. ID sản phẩm chỉ được lấy từ context; backend kiểm tra lại sở hữu.
                'Thanh toán', 'đặt hàng', 'mua luôn' chỉ là CHECKOUT_SUMMARY.
                paymentMethod chỉ COD hoặc PAYOS. addressIndex là số thứ tự địa chỉ (1-based).
                sort là PRICE_ASC/PRICE_DESC. sale là true khi khách yêu cầu đang giảm giá.
                Nếu nhắc mẫu N, đặt referenceIndexes là mảng số N (1-based).
                JSON phải khớp các field AgentPlan; field không biết để null.
                """
                + "\nAuthenticated=" + (userId != null)
                + "\nCategories=" + info.categories()
                + "\nBrands=" + info.brands()
                + "\nLastProductIds=" + context.getLastProductIds()
                + "\nLastVariantIds=" + context.getLastVariantIds()
                + "\nLastCartItemIds=" + context.getLastCartItemIds()
                + "\nLastSearch=" + objectMapper.writeValueAsString(context.getLastSearchRequest())
                + "\nSelectedProductId=" + context.getSelectedProductId()
                + "\nSelectedVariantId=" + context.getSelectedVariantId()
                + "\nSelectedSize=" + context.getSelectedSize()
                + "\nSelectedColor=" + context.getSelectedColor()
                + "\nAgentPlanFields=action,productType,audience,minPrice,maxPrice,targetPrice,totalBudget,size,color,brand,occasion,style,productId,variantId,cartItemId,orderId,quantity,voucherCode,referenceIndexes,reply,keyword,category,sale,sort,stock,limit,paymentMethod,addressIndex,orderStatus"
                + "\nUSER: " + message;
        try {
            JsonNode json = groqClient.callJson("Bạn là JODOK Agent Planner. Chỉ xuất JSON hợp lệ; reply bằng tiếng Việt.", prompt, 900);
            if (json == null || !json.isObject()) return fallback();
            AgentPlan result = objectMapper.readerFor(AgentPlan.class)
                    .without(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                    .readValue(json);
            if (result == null || result.action() == null || result.action().toUpperCase(java.util.Locale.ROOT).contains("CONFIRM")) return fallback();
            context.touch();
            return result;
        } catch (Exception exception) {
            // Never expose provider response bodies, API keys, SQL, or raw exception messages.
            return fallback();
        }
    }

    public AgentContext context(String conversationId) {
        String key = conversationId == null || conversationId.isBlank() ? "anonymous" : conversationId.trim();
        long now = System.currentTimeMillis();
        if (contexts.size() >= MAX_CONTEXTS) {
            contexts.entrySet().removeIf(entry -> now - entry.getValue().getUpdatedAt() > TTL_MS);
            if (contexts.size() >= MAX_CONTEXTS && !contexts.containsKey(key)) {
                String oldest = contexts.entrySet().stream()
                        .min(java.util.Comparator.comparingLong(entry -> entry.getValue().getUpdatedAt()))
                        .map(Map.Entry::getKey).orElse(null);
                if (oldest != null) contexts.remove(oldest);
            }
        }
        return contexts.compute(key, (ignored, current) -> current == null || now - current.getUpdatedAt() > TTL_MS
                ? new AgentContext() : current);
    }

    private AgentPlan fallback() {
        return AgentPlan.builder().action("ASK_CLARIFICATION")
                .reply("Mình chưa hiểu rõ yêu cầu. Bạn có thể nói như “áo nam khoảng 200k”, “xem giỏ hàng” hoặc “thanh toán” nhé.").build();
    }

    public ProductTool productTool() { return productTool; }
    public CartTool cartTool() { return cartTool; }
    public OrderTool orderTool() { return orderTool; }
    public VoucherTool voucherTool() { return voucherTool; }
    public StylistTool stylistTool() { return stylistTool; }
}
