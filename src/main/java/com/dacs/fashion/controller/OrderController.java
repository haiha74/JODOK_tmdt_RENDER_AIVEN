package com.dacs.fashion.controller;

import com.dacs.fashion.dto.CheckoutDTO;
import com.dacs.fashion.dto.CreateOrderDTO;
import com.dacs.fashion.entity.Order;
import com.dacs.fashion.entity.User;
import com.dacs.fashion.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import org.springframework.jdbc.core.JdbcTemplate;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final JdbcTemplate jdbcTemplate;

    // Dashboard projection: avoids serializing entire JPA object graphs.
    @GetMapping("/admin-overview")
    public ResponseEntity<?> getAdminOverview(Authentication authentication) {
        User me = (User) authentication.getPrincipal();
        if (!"ADMIN".equals(me.getRole()) && !"STAFF".equals(me.getRole())) {
            return ResponseEntity.status(403).body(Map.of("message", "Không có quyền"));
        }
        List<Map<String, Object>> result = new ArrayList<>();
        Map<Long, Map<String, Object>> byId = new LinkedHashMap<>();
        jdbcTemplate.query("""
            SELECT o.order_id, o.order_code, o.created_at, o.order_status,
                   o.final_amount, o.total_amount, o.address, o.updated_by_staff,
                   u.fullname, u.email, u.phone, u.user_id, su.fullname AS staff_name, pay.payment_method
            FROM orders o JOIN users u ON u.user_id = o.user_id
            LEFT JOIN users su ON su.user_id = o.staff_id
            LEFT JOIN payments pay ON pay.order_id = o.order_id
            ORDER BY o.created_at DESC
            """, rs -> {
            long id = rs.getLong("order_id");
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("orderId", id);
            row.put("orderCode", rs.getString("order_code"));
            row.put("createdAt", rs.getTimestamp("created_at") == null ? null : rs.getTimestamp("created_at").toLocalDateTime().toString());
            row.put("orderStatus", rs.getString("order_status"));
            row.put("finalAmount", rs.getBigDecimal("final_amount"));
            row.put("totalAmount", rs.getBigDecimal("total_amount"));
            row.put("address", rs.getString("address"));
            row.put("updatedByStaff", rs.getString("updated_by_staff"));
            row.put("staffName", rs.getString("staff_name"));
            row.put("paymentMethod", rs.getString("payment_method"));
            row.put("user", Map.of("userId", rs.getLong("user_id"),
                "fullname", rs.getString("fullname") == null ? "" : rs.getString("fullname"),
                "phone", rs.getString("phone") == null ? "" : rs.getString("phone"),
                "email", rs.getString("email") == null ? "" : rs.getString("email")));
            row.put("items", new ArrayList<Map<String, Object>>());
            result.add(row);
            byId.put(id, row);
        });
        jdbcTemplate.query("""
            SELECT oi.order_id, oi.quantity, oi.price, p.product_id, p.product_name
            FROM order_items oi
            JOIN product_variants v ON v.variant_id = oi.variant_id
            JOIN products p ON p.product_id = v.product_id
            """, rs -> {
            Map<String, Object> order = byId.get(rs.getLong("order_id"));
            if (order != null) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> items = (List<Map<String, Object>>) order.get("items");
                items.add(Map.of(
                    "quantity", rs.getInt("quantity"),
                    "price", rs.getBigDecimal("price") == null ? java.math.BigDecimal.ZERO : rs.getBigDecimal("price"),
                    "variant", Map.of("product", Map.of("productId", rs.getLong("product_id"),
                        "productName", rs.getString("product_name") == null ? "" : rs.getString("product_name")))
                ));
            }
        });
        return ResponseEntity.ok(result);
    }

    @GetMapping
    public ResponseEntity<?> getAll() {
        return ResponseEntity.ok(orderService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return ResponseEntity.ok(orderService.getById(id));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getByUser(@PathVariable Long userId, Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();

        if (!currentUser.getUserId().equals(userId)
                && !"ADMIN".equals(currentUser.getRole())
                && !"STAFF".equals(currentUser.getRole())) {
            return ResponseEntity.status(403)
                    .body(Map.of("message", "Không có quyền xem đơn hàng này"));
        }

        return ResponseEntity.ok(orderService.getByUser(userId));
    }

    @PostMapping("/from-cart")
    public ResponseEntity<?> createFromCart(@RequestBody CreateOrderDTO dto,
                                            Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();
        dto.setUserId(currentUser.getUserId());

        try {
            return ResponseEntity.ok(orderService.createFromCart(dto));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id,
                                          @RequestParam String status,
                                          Authentication authentication) {
        User staff = (User) authentication.getPrincipal();

        try {
            return ResponseEntity.ok(
                    orderService.updateStatus(id, status, staff.getFullname())
            );
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/checkout")
    public ResponseEntity<?> checkout(@RequestBody CheckoutDTO dto,
                                      Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();
        dto.setUserId(currentUser.getUserId());

        try {
            return ResponseEntity.ok(orderService.checkout(dto));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/{id}/paid")
    public ResponseEntity<?> markPaid(@PathVariable Long id,
                                      Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();
        Order order = orderService.getById(id);

        if (!order.getUser().getUserId().equals(currentUser.getUserId())
                && !"ADMIN".equals(currentUser.getRole())
                && !"STAFF".equals(currentUser.getRole())) {
            return ResponseEntity.status(403)
                    .body(Map.of("message", "Không có quyền cập nhật đơn này"));
        }

        return ResponseEntity.ok(orderService.markPaid(id));
    }
}