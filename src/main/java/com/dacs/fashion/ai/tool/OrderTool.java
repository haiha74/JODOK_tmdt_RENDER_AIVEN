package com.dacs.fashion.ai.tool;

import com.dacs.fashion.entity.Order;
import com.dacs.fashion.service.OrderService;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Map;
import java.util.LinkedHashMap;
import java.math.BigDecimal;
import java.util.Locale;
import org.springframework.transaction.annotation.Transactional;

@Component
public class OrderTool {
    private final OrderService orderService;
    public OrderTool(OrderService orderService) { this.orderService = orderService; }

    public List<Order> listMine(Long userId) {
        requireUser(userId);
        return orderService.getByUser(userId).stream()
                .sorted(Comparator.comparing(Order::getOrderId, Comparator.nullsLast(Long::compareTo)).reversed())
                .toList();
    }

    public Order getMine(Long userId, Long orderId) {
        requireUser(userId);
        if (orderId == null) throw new IllegalArgumentException("Thiếu mã đơn hàng.");
        Order order = orderService.getById(orderId);
        if (order.getUser() == null || !Objects.equals(order.getUser().getUserId(), userId))
            throw new SecurityException("Bạn không có quyền xem đơn hàng này.");
        return order;
    }

    @Transactional
    public Order cancelMine(Long userId, Long orderId) {
        Order order = getMine(userId, orderId);
        String status = order.getOrderStatus();
        // The shop exposes status mutation to staff only. Customer chatbot cancellation
        // is limited to unpaid orders that have not been confirmed or dispatched.
        if (!List.of("PENDING", "PENDING_PAYMENT").contains(status == null ? "" : status.toUpperCase(Locale.ROOT))
                || (order.getPayment() != null && "PAID".equalsIgnoreCase(order.getPayment().getPaymentStatus())))
            throw new IllegalStateException("Chỉ có thể hủy đơn chưa thanh toán và chưa được xác nhận. Vui lòng liên hệ cửa hàng cho đơn này.");
        return orderService.updateStatus(orderId, "CANCELLED", "CUSTOMER");
    }

    public List<Map<String, Object>> summariesMine(Long userId) {
        return listMine(userId).stream().map(this::summary).toList();
    }

    public Map<String, Object> summary(Order order) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orderId", order.getOrderId());
        result.put("status", text(order.getOrderStatus()));
        result.put("statusLabel", statusLabel(order.getOrderStatus()));
        result.put("paymentMethod", order.getPayment() == null ? "" : text(order.getPayment().getPaymentMethod()));
        String paymentStatus = order.getPayment() == null ? "" : text(order.getPayment().getPaymentStatus());
        result.put("paymentStatus", paymentStatus);
        result.put("paymentStatusLabel", paymentStatusLabel(paymentStatus));
        result.put("total", order.getFinalAmount());
        result.put("createdAt", order.getCreatedAt() == null ? "" : order.getCreatedAt().toString());
        result.put("address", text(order.getAddress()));
        result.put("items", order.getItems() == null ? List.of() : order.getItems().stream().map(item -> {
            Map<String, Object> line = new LinkedHashMap<>();
            var variant = item.getVariant();
            line.put("productName", variant == null || variant.getProduct() == null ? "Sản phẩm" : text(variant.getProduct().getProductName()));
            line.put("size", variant == null ? "" : text(variant.getSize()));
            line.put("color", variant == null ? "" : text(variant.getColor()));
            line.put("quantity", item.getQuantity());
            line.put("price", item.getPrice());
            line.put("lineTotal", item.getPrice() == null || item.getQuantity() == null ? BigDecimal.ZERO
                    : item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())));
            return line;
        }).toList());
        return result;
    }

    public static String statusLabel(String status) {
        return switch (text(status).toUpperCase(Locale.ROOT)) {
            case "PENDING" -> "Chờ xác nhận";
            case "PENDING_PAYMENT" -> "Chờ thanh toán";
            case "PAID" -> "Đã thanh toán";
            case "CONFIRMED" -> "Đã xác nhận";
            case "SHIPPING" -> "Đang giao hàng";
            case "COMPLETED" -> "Hoàn thành";
            case "CANCELLED" -> "Đã hủy";
            default -> "Chưa xác định";
        };
    }

    public static String paymentStatusLabel(String status) {
        return switch (text(status).toUpperCase(Locale.ROOT)) {
            case "UNPAID" -> "Chưa thanh toán";
            case "PENDING" -> "Chờ thanh toán";
            case "PAID" -> "Đã thanh toán";
            case "FAILED" -> "Thanh toán thất bại";
            case "CANCELLED" -> "Đã hủy";
            default -> "Chưa có thông tin";
        };
    }

    private static String text(String value) { return value == null ? "" : value; }

    private void requireUser(Long userId) {
        if (userId == null) throw new SecurityException("Vui lòng đăng nhập để xem đơn hàng.");
    }
}
