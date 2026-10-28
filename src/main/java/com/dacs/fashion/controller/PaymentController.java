package com.dacs.fashion.controller;

import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import com.dacs.fashion.entity.Payment;
import com.dacs.fashion.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import com.dacs.fashion.entity.Order;
import com.dacs.fashion.service.OrderService;
import java.util.List;
import org.springframework.security.core.Authentication;
import com.dacs.fashion.entity.User;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final OrderService orderService;
    @Value("${payos.client-id}")
    private String clientId;

    @Value("${payos.api-key}")
    private String apiKey;

    @Value("${payos.checksum-key}")
    private String checksumKey;

    @Value("${app.public-base-url:http://localhost:8080}")
    private String publicBaseUrl;


    private String hmacSHA256(String data, String key) throws Exception {
        Mac hmac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKey = new SecretKeySpec(key.getBytes("UTF-8"), "HmacSHA256");
        hmac.init(secretKey);

        byte[] bytes = hmac.doFinal(data.getBytes("UTF-8"));

        StringBuilder hash = new StringBuilder();
        for (byte b : bytes) {
            hash.append(String.format("%02x", b));
        }
        return hash.toString();
    }

    @GetMapping
    public List<Payment> getAll() {
        return paymentService.getAll();
    }

    @GetMapping("/{id}")
    public Payment getById(@PathVariable Long id) {
        return paymentService.getById(id);
    }

    @PostMapping
    public Payment create(@RequestParam Long orderId,
                          @RequestParam String method) {
        return paymentService.create(orderId, method);
    }

    @PutMapping("/{id}/status")
    public Payment updateStatus(@PathVariable Long id,
                                @RequestParam String status) {
        return paymentService.updateStatus(id, status);
    }

    @DeleteMapping("/{id}")
    public String delete(@PathVariable Long id) {
        paymentService.delete(id);
        return "Xóa thanh toán thành công";
    }


    @PostMapping("/payos/create")
    public Object createPayOSPayment(@RequestBody Map<String, Object> body, Authentication authentication) {

        try {
            long orderCode = Long.parseLong(body.get("orderId").toString());

            Order order = orderService.getById(orderCode);
            User currentUser = (User) authentication.getPrincipal();

            if (!order.getUser().getUserId().equals(currentUser.getUserId())
                    && !"ADMIN".equals(currentUser.getRole())
                    && !"STAFF".equals(currentUser.getRole())) {
                return Map.of("error", "Không có quyền thanh toán đơn hàng này");
            }

            int amount = order.getFinalAmount().intValue();

            String description = "Don hang " + orderCode;

            if (description.length() > 25) {
                description = description.substring(0, 25);
            }

            String effectiveBaseUrl = (publicBaseUrl == null || publicBaseUrl.isBlank())
                    ? ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString()
                    : publicBaseUrl;
            String returnUrl = effectiveBaseUrl.replaceAll("/+$", "") + "/orders";
            String cancelUrl = effectiveBaseUrl.replaceAll("/+$", "") + "/payment";

            String rawSignature =
                    "amount=" + amount +
                    "&cancelUrl=" + cancelUrl +
                    "&description=" + description +
                    "&orderCode=" + orderCode +
                    "&returnUrl=" + returnUrl;

            String signature = hmacSHA256(rawSignature, checksumKey);

            RestTemplate restTemplate = new RestTemplate();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("x-client-id", clientId);
            headers.set("x-api-key", apiKey);

            Map<String, Object> payload = Map.of(
                    "orderCode", orderCode,
                    "amount", amount,
                    "description", description,
                    "returnUrl", returnUrl,
                    "cancelUrl", cancelUrl,
                    "signature", signature
            );

            HttpEntity<Map<String, Object>> entity =
                    new HttpEntity<>(payload, headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    "https://api-merchant.payos.vn/v2/payment-requests",
                    HttpMethod.POST,
                    entity,
                    Map.class
            );

            return response.getBody();

        } catch (Exception e) {
            e.printStackTrace();
            return Map.of("error", e.getMessage());
        }
    }


}

