package com.dacs.fashion.controller;

import com.dacs.fashion.entity.User;
import com.dacs.fashion.service.AgentChatbotService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/chatbot")
@RequiredArgsConstructor
public class ChatbotController {

    private final AgentChatbotService chatbotService;

    /*
     * conversationId là optional để tương thích frontend cũ.
     * Nếu frontend đã gửi conversationId thì V9 giữ đúng memory theo phiên chat.
     */
    public record ChatRequest(
            String message,
            String conversationId,
            String confirmationToken
    ) {
        public ChatRequest(String message, String conversationId) { this(message, conversationId, null); }
    }

    public record ChatProduct(
            Long productId,
            Long variantId,
            String productName,
            BigDecimal price,
            String size,
            String color,
            Integer stock,
            String imageUrl,
            BigDecimal originalPrice
    ) {
        public ChatProduct(Long productId, Long variantId, String productName, BigDecimal price,
                           String size, String color, Integer stock) {
            this(productId, variantId, productName, price, size, color, stock, null, null);
        }
    }

    public record ChatResponse(
            String reply,
            List<ChatProduct> products,
            Map<String, Object> metadata
    ) {
        public ChatResponse(String reply, List<ChatProduct> products) { this(reply, products, Map.of()); }
    }

    @PostMapping("/message")
    public ChatResponse message(
            @RequestBody ChatRequest request,
            Authentication authentication
    ) {
        if (request == null
                || request.message() == null
                || request.message().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập nội dung tin nhắn"
            );
        }

        if (request.message().length() > 500) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tin nhắn không được vượt quá 500 ký tự"
            );
        }

        String conversationId =
                request.conversationId() == null || request.conversationId().isBlank()
                        ? "anonymous-" + UUID.randomUUID()
                        : request.conversationId().trim();

        if (conversationId.length() > 120 || !conversationId.matches("[A-Za-z0-9_-]+")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã hội thoại không hợp lệ");
        }

        Long authenticatedUserId = getAuthenticatedUserId(authentication);

        return chatbotService.reply(
                request.message().trim(),
                conversationId,
                authenticatedUserId,
                request.confirmationToken()
        );
    }

    /*
     * Search/tư vấn vẫn dùng được khi chưa đăng nhập.
     * Cart Tool sẽ tự yêu cầu đăng nhập nếu userId == null.
     */
    private Long getAuthenticatedUserId(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof User user)
                || user.getUserId() == null) {
            return null;
        }

        return user.getUserId();
    }
}
