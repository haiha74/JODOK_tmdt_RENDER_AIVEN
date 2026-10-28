package com.dacs.fashion.controller;

import com.dacs.fashion.dto.CartItemDTO;
import com.dacs.fashion.entity.Cart;
import com.dacs.fashion.entity.User;
import com.dacs.fashion.service.CartService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    /*
     * =========================================================
     * GET CART
     * =========================================================
     */
    @GetMapping("/{userId}")
    public ResponseEntity<?> getCart(
            @PathVariable Long userId,
            Authentication authentication
    ) {

        try {

            User currentUser = getCurrentUser(authentication);

            if (!currentUser.getUserId().equals(userId)) {
                return ResponseEntity
                        .status(403)
                        .body(message("Không có quyền xem giỏ hàng này"));
            }

            Cart cart = cartService.getCart(userId);

            return ResponseEntity.ok(cart);

        } catch (RuntimeException e) {

            e.printStackTrace();

            return ResponseEntity
                    .badRequest()
                    .body(message(
                            e.getMessage() != null
                                    ? e.getMessage()
                                    : "Không tải được giỏ hàng"
                    ));
        }
    }


    /*
     * =========================================================
     * ADD TO CART
     * =========================================================
     */
    @PostMapping("/add")
    public ResponseEntity<?> addToCart(
            @RequestBody CartItemDTO dto,
            Authentication authentication
    ) {

        try {

            User currentUser = getCurrentUser(authentication);

            /*
             * Không tin userId gửi từ frontend.
             * Luôn lấy user đang đăng nhập từ JWT.
             */
            dto.setUserId(currentUser.getUserId());

            if (dto.getVariantId() == null) {
                return ResponseEntity
                        .badRequest()
                        .body(message("Thiếu variantId"));
            }

            if (dto.getQuantity() == null) {
                dto.setQuantity(1);
            }

            if (dto.getQuantity() <= 0) {
                return ResponseEntity
                        .badRequest()
                        .body(message("Số lượng phải lớn hơn 0"));
            }

            Cart cart = cartService.addToCart(dto);

            return ResponseEntity.ok(cart);

        } catch (RuntimeException e) {

            e.printStackTrace();

            return ResponseEntity
                    .badRequest()
                    .body(message(
                            e.getMessage() != null
                                    ? e.getMessage()
                                    : "Thêm giỏ hàng thất bại"
                    ));
        }
    }


    /*
     * =========================================================
     * UPDATE QUANTITY
     * =========================================================
     */
    @PutMapping("/items/{itemId}")
    public ResponseEntity<?> updateQuantity(
            @PathVariable Long itemId,
            @RequestParam Integer quantity,
            Authentication authentication
    ) {

        try {

            User currentUser = getCurrentUser(authentication);

            if (!cartService.isItemOwner(
                    itemId,
                    currentUser.getUserId()
            )) {

                return ResponseEntity
                        .status(403)
                        .body(message("Không có quyền sửa sản phẩm này"));
            }

            Cart cart = cartService.updateQuantity(
                    itemId,
                    quantity
            );

            return ResponseEntity.ok(cart);

        } catch (RuntimeException e) {

            e.printStackTrace();

            return ResponseEntity
                    .badRequest()
                    .body(message(
                            e.getMessage() != null
                                    ? e.getMessage()
                                    : "Không thể cập nhật số lượng"
                    ));
        }
    }


    /*
     * =========================================================
     * REMOVE ITEM
     * =========================================================
     */
    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<?> removeItem(
            @PathVariable Long itemId,
            Authentication authentication
    ) {

        try {

            User currentUser = getCurrentUser(authentication);

            if (!cartService.isItemOwner(
                    itemId,
                    currentUser.getUserId()
            )) {

                return ResponseEntity
                        .status(403)
                        .body(message("Không có quyền xóa sản phẩm này"));
            }

            cartService.removeItem(itemId);

            return ResponseEntity.ok(
                    message("Đã xóa sản phẩm khỏi giỏ hàng")
            );

        } catch (RuntimeException e) {

            e.printStackTrace();

            return ResponseEntity
                    .badRequest()
                    .body(message(
                            e.getMessage() != null
                                    ? e.getMessage()
                                    : "Không thể xóa sản phẩm"
                    ));
        }
    }


    /*
     * =========================================================
     * CLEAR CART
     * =========================================================
     */
    @DeleteMapping("/clear/{userId}")
    public ResponseEntity<?> clearCart(
            @PathVariable Long userId,
            Authentication authentication
    ) {

        try {

            User currentUser = getCurrentUser(authentication);

            if (!currentUser.getUserId().equals(userId)) {

                return ResponseEntity
                        .status(403)
                        .body(message("Không có quyền xóa giỏ hàng này"));
            }

            cartService.clearCart(userId);

            return ResponseEntity.ok(
                    cartService.getCart(userId)
            );

        } catch (RuntimeException e) {

            e.printStackTrace();

            return ResponseEntity
                    .badRequest()
                    .body(message(
                            e.getMessage() != null
                                    ? e.getMessage()
                                    : "Không thể xóa giỏ hàng"
                    ));
        }
    }


    /*
     * =========================================================
     * GET CURRENT USER
     * =========================================================
     */
    private User getCurrentUser(Authentication authentication) {

        if (
                authentication == null ||
                authentication.getPrincipal() == null ||
                !(authentication.getPrincipal() instanceof User)
        ) {

            throw new RuntimeException(
                    "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại."
            );
        }

        return (User) authentication.getPrincipal();
    }


    /*
     * =========================================================
     * JSON MESSAGE
     * =========================================================
     */
    private Map<String, Object> message(String text) {

        Map<String, Object> response = new LinkedHashMap<>();

        response.put("message", text);

        return response;
    }
}