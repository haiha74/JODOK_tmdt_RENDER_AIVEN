package com.dacs.fashion.ai.tool;

import com.dacs.fashion.dto.CheckoutDTO;
import com.dacs.fashion.entity.CartItem;
import com.dacs.fashion.entity.Order;
import com.dacs.fashion.entity.Payment;
import com.dacs.fashion.entity.ProductVariant;
import com.dacs.fashion.entity.User;
import com.dacs.fashion.repository.ProductVariantRepository;
import com.dacs.fashion.repository.UserRepository;
import com.dacs.fashion.service.OrderService;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/** Chatbot adapter: all prices and order writes still use the shop's commerce services. */
@Component
public class CheckoutTool {
    private final CartTool cartTool;
    private final OrderTool orderTool;
    private final OrderService orderService;
    private final UserRepository userRepository;
    private final ProductVariantRepository variantRepository;

    public CheckoutTool(CartTool cartTool, OrderTool orderTool, OrderService orderService,
                        UserRepository userRepository, ProductVariantRepository variantRepository) {
        this.cartTool = cartTool;
        this.orderTool = orderTool;
        this.orderService = orderService;
        this.userRepository = userRepository;
        this.variantRepository = variantRepository;
    }

    public record Quote(List<Map<String, Object>> items, BigDecimal subtotal, BigDecimal discount,
                        BigDecimal shipping, BigDecimal total, Map<String, Object> address,
                        String voucherCode, String paymentMethod, String fingerprint) {
        public Quote {
            items = items.stream().map(item -> Collections.unmodifiableMap(new LinkedHashMap<>(item))).toList();
            address = Collections.unmodifiableMap(new LinkedHashMap<>(address));
        }
    }

    public List<Map<String, Object>> addresses(Long userId) {
        Map<String, Object> address = profileAddress(user(userId));
        return completeAddress(address) ? List.of(address) : List.of();
    }

    @Transactional(readOnly = true)
    public Quote quote(Long userId, String voucherCode, String paymentMethod) {
        User user = user(userId);
        String method = normalizeMethod(paymentMethod);
        String code = voucherCode == null || voucherCode.isBlank() ? null : voucherCode.trim();
        List<CartItem> cart = cartTool.orderedItems(userId);
        if (cart.isEmpty()) throw new IllegalStateException("Giỏ hàng trống. Hãy thêm sản phẩm trước khi đặt hàng.");
        List<Map<String, Object>> lines = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        for (CartItem item : cart) {
            if (item.getVariant() == null || item.getVariant().getVariantId() == null)
                throw new IllegalStateException("Có sản phẩm không còn tồn tại trong giỏ. Vui lòng kiểm tra lại.");
            ProductVariant variant = variantRepository.findById(item.getVariant().getVariantId())
                    .orElseThrow(() -> new IllegalStateException("Biến thể sản phẩm không còn tồn tại."));
            CartTool.validateVariant(variant, item.getQuantity());
            BigDecimal lineTotal = variant.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
            subtotal = subtotal.add(lineTotal);
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("cartItemId", item.getCartItemId());
            line.put("variantId", variant.getVariantId());
            line.put("productId", variant.getProduct().getProductId());
            line.put("productName", text(variant.getProduct().getProductName()));
            line.put("size", text(variant.getSize()));
            line.put("color", text(variant.getColor()));
            line.put("quantity", item.getQuantity());
            line.put("price", variant.getPrice());
            line.put("lineTotal", lineTotal);
            lines.add(line);
        }
        OrderService.Pricing pricing = orderService.calculatePricing(subtotal, code);
        Map<String, Object> address = profileAddress(user);
        String fingerprint = fingerprint(userId, lines, pricing, address, code, method);
        return new Quote(lines, pricing.subtotal(), pricing.discount(), pricing.shipping(), pricing.total(),
                address, code, method, fingerprint);
    }

    @Transactional
    public Order create(Long userId, Quote expected) {
        if (expected == null) throw new IllegalArgumentException("Vui lòng xem và xác nhận tóm tắt đơn hàng trước.");
        if (expected.paymentMethod() == null)
            throw new IllegalArgumentException("Vui lòng chọn COD hoặc QR trước khi xác nhận.");
        Quote current = quote(userId, expected.voucherCode(), expected.paymentMethod());
        if (!Objects.equals(expected.fingerprint(), current.fingerprint()))
            throw new IllegalStateException("Giỏ hàng, giá, voucher hoặc địa chỉ đã thay đổi. Vui lòng xem lại và xác nhận tóm tắt mới.");
        if (!completeAddress(current.address()))
            throw new IllegalStateException("Vui lòng cập nhật họ tên, số điện thoại và địa chỉ trong tài khoản trước khi đặt hàng.");
        String fullname = current.address().get("fullname").toString();
        String phone = current.address().get("phone").toString();
        String address = current.address().get("address").toString();
        if (!phone.matches("0[0-9]{9}"))
            throw new IllegalStateException("Số điện thoại trong tài khoản chưa hợp lệ. Vui lòng cập nhật trước khi đặt hàng.");
        CheckoutDTO dto = new CheckoutDTO();
        dto.setUserId(userId);
        dto.setFullname(fullname);
        dto.setPhone(phone);
        dto.setAddress(address);
        dto.setVoucherCode(current.voucherCode());
        dto.setPaymentMethod(current.paymentMethod());
        return orderService.checkout(dto);
    }

    public Map<String, Object> paymentAction(Long userId, Long orderId) {
        Order order = orderTool.getMine(userId, orderId);
        Payment payment = order.getPayment();
        if (!"PENDING_PAYMENT".equalsIgnoreCase(order.getOrderStatus()) || payment == null
                || !"QR".equalsIgnoreCase(payment.getPaymentMethod())
                || !"PENDING".equalsIgnoreCase(payment.getPaymentStatus()))
            throw new IllegalStateException("Đơn này không còn ở trạng thái chờ thanh toán QR.");
        return Map.of("orderId", order.getOrderId(), "method", "QR", "status", "PENDING");
    }

    public Map<String, Object> asMap(Quote quote) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("items", quote.items());
        map.put("subtotal", quote.subtotal());
        map.put("discount", quote.discount());
        map.put("shipping", quote.shipping());
        map.put("total", quote.total());
        map.put("address", quote.address());
        map.put("voucherCode", quote.voucherCode());
        map.put("paymentMethod", quote.paymentMethod());
        return map;
    }

    private User user(Long userId) {
        if (userId == null) throw new SecurityException("Vui lòng đăng nhập để đặt hàng.");
        return userRepository.findById(userId)
                .orElseThrow(() -> new SecurityException("Phiên đăng nhập không còn hợp lệ."));
    }

    private Map<String, Object> profileAddress(User user) {
        Map<String, Object> address = new LinkedHashMap<>();
        address.put("id", 1);
        address.put("fullname", text(user.getFullname()).trim());
        address.put("phone", text(user.getPhone()).trim());
        address.put("address", text(user.getAddress()).trim());
        return Collections.unmodifiableMap(address);
    }

    private boolean completeAddress(Map<String, Object> address) {
        return !address.get("fullname").toString().isBlank() && address.get("phone").toString().matches("0[0-9]{9}")
                && !address.get("address").toString().isBlank();
    }

    private String normalizeMethod(String method) {
        if (method == null || method.isBlank()) return null;
        String normalized = method.trim().toUpperCase(Locale.ROOT);
        if ("COD".equals(normalized)) normalized = "CASH";
        if (!List.of("CASH", "QR").contains(normalized))
            throw new IllegalArgumentException("Cửa hàng hỗ trợ COD hoặc QR.");
        return normalized;
    }

    private String fingerprint(Long userId, List<Map<String, Object>> lines, OrderService.Pricing pricing,
                               Map<String, Object> address, String code, String method) {
        // Length-prefixed fields avoid delimiter collisions in names and addresses.
        StringBuilder value = new StringBuilder();
        append(value, userId);
        for (Map<String, Object> line : lines) line.forEach((key, item) -> { append(value, key); append(value, item); });
        address.forEach((key, item) -> { append(value, key); append(value, item); });
        append(value, pricing.subtotal()); append(value, pricing.discount());
        append(value, pricing.shipping()); append(value, pricing.total());
        append(value, code); append(value, method);
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    private void append(StringBuilder value, Object field) {
        String text = field instanceof BigDecimal decimal ? decimal.stripTrailingZeros().toPlainString()
                : field == null ? "" : field.toString();
        value.append(text.length()).append(':').append(text);
    }

    private static String text(String value) { return value == null ? "" : value; }
}
