package com.dacs.fashion.service;

import com.dacs.fashion.dto.CartItemDTO;
import com.dacs.fashion.entity.Cart;
import com.dacs.fashion.entity.CartItem;
import com.dacs.fashion.entity.ProductVariant;
import com.dacs.fashion.entity.User;
import com.dacs.fashion.repository.CartItemRepository;
import com.dacs.fashion.repository.CartRepository;
import com.dacs.fashion.repository.ProductVariantRepository;
import com.dacs.fashion.repository.UserRepository;
import java.util.Objects;

import jakarta.transaction.Transactional;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;

import java.util.ArrayList;

@Service
@RequiredArgsConstructor
public class CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;
    private final ProductVariantRepository variantRepository;


    /*
     * =========================================================
     * GET CART
     * =========================================================
     */
    @Transactional
    public Cart getCart(Long userId) {

        if (userId == null) {
            throw new RuntimeException("Thiếu userId");
        }

        Cart cart = cartRepository
                .findByUser_UserId(userId)
                .orElseGet(() -> createCart(userId));

        /*
         * Tránh trường hợp items bị null.
         */
        if (cart.getItems() == null) {
            cart.setItems(new ArrayList<>());
        }

        /*
         * Force load items trong transaction.
         */
        cart.getItems().size();

        return cart;
    }


    /*
     * =========================================================
     * CHECK ITEM OWNER
     * =========================================================
     */
    @Transactional
    public boolean isItemOwner(
            Long itemId,
            Long userId
    ) {

        if (itemId == null || userId == null) {
            return false;
        }

        CartItem item = cartItemRepository
                .findById(itemId)
                .orElseThrow(
                        () -> new RuntimeException(
                                "Không tìm thấy sản phẩm trong giỏ hàng"
                        )
                );

        if (
                item.getCart() == null ||
                item.getCart().getUser() == null ||
                item.getCart().getUser().getUserId() == null
        ) {
            return false;
        }

        return item
                .getCart()
                .getUser()
                .getUserId()
                .equals(userId);
    }


    /*
     * =========================================================
     * CREATE CART
     * =========================================================
     */
    private Cart createCart(Long userId) {

        User user = userRepository
                .findById(userId)
                .orElseThrow(
                        () -> new RuntimeException(
                                "Không tìm thấy tài khoản người dùng"
                        )
                );

        Cart cart = new Cart();

        cart.setUser(user);
        cart.setItems(new ArrayList<>());

        return cartRepository.save(cart);
    }


    /*
     * =========================================================
     * ADD TO CART
     * =========================================================
     */
    @Transactional
    public Cart addToCart(CartItemDTO dto) {

        if (dto == null) {
            throw new RuntimeException(
                    "Dữ liệu thêm giỏ hàng không hợp lệ"
            );
        }

        if (dto.getUserId() == null) {
            throw new RuntimeException(
                    "Không xác định được người dùng"
            );
        }

        if (dto.getVariantId() == null) {
            throw new RuntimeException(
                    "Vui lòng chọn size và màu sắc"
            );
        }

        int qty =
                dto.getQuantity() == null
                        ? 1
                        : dto.getQuantity();

        if (qty <= 0) {
            throw new RuntimeException(
                    "Số lượng phải lớn hơn 0"
            );
        }


        /*
         * Lấy giỏ hàng.
         */
        Cart cart = getCart(dto.getUserId());


        /*
         * Lấy variant.
         */
        ProductVariant variant = variantRepository
                .findById(dto.getVariantId())
                .orElseThrow(
                        () -> new RuntimeException(
                                "Không tìm thấy biến thể sản phẩm"
                        )
                );


        /*
         * Kiểm tra trạng thái variant.
         *
         * Một số dữ liệu cũ có thể status null.
         * Chỉ chặn khi status có giá trị và khác ACTIVE.
         */
        if (
                variant.getStatus() != null &&
                !variant.getStatus().isBlank() &&
                !"ACTIVE".equalsIgnoreCase(
                        variant.getStatus()
                )
        ) {

            throw new RuntimeException(
                    "Biến thể sản phẩm hiện không hoạt động"
            );
        }


        /*
         * Kiểm tra tồn kho.
         */
        int stock =
                variant.getStock() == null
                        ? 0
                        : variant.getStock();

        if (stock <= 0) {
            throw new RuntimeException(
                    "Sản phẩm đã hết hàng"
            );
        }

        if (qty > stock) {
            throw new RuntimeException(
                    "Số lượng vượt quá tồn kho"
            );
        }


        /*
         * Tìm xem variant đã có trong cart chưa.
         */
        CartItem item = cartItemRepository
                .findByCartAndVariant(cart, variant)
                .orElse(null);


        /*
         * Chưa có -> tạo mới.
         */
        if (item == null) {

            item = new CartItem();

            item.setCart(cart);
            item.setVariant(variant);
            item.setQuantity(qty);

        } else {

            /*
             * Đã có -> cộng thêm số lượng.
             */
            int currentQty =
                    item.getQuantity() == null
                            ? 0
                            : item.getQuantity();

            int newQty = currentQty + qty;

            if (newQty > stock) {

                throw new RuntimeException(
                        "Tổng số lượng trong giỏ vượt quá tồn kho. " +
                        "Hiện còn " + stock + " sản phẩm."
                );
            }

            item.setQuantity(newQty);
        }


        /*
         * Lưu item.
         */
        cartItemRepository.save(item);

        cartItemRepository.flush();


        /*
         * Lấy lại cart mới nhất.
         */
        return getCart(dto.getUserId());
    }


    /*
     * =========================================================
     * UPDATE QUANTITY
     * =========================================================
     */
    @Transactional
    public Cart updateQuantity(
            Long itemId,
            Integer quantity
    ) {

        if (itemId == null) {
            throw new RuntimeException(
                    "Thiếu mã sản phẩm trong giỏ"
            );
        }

        CartItem item = cartItemRepository
                .findById(itemId)
                .orElseThrow(
                        () -> new RuntimeException(
                                "Không tìm thấy sản phẩm trong giỏ"
                        )
                );


        if (
                item.getCart() == null ||
                item.getCart().getUser() == null
        ) {

            throw new RuntimeException(
                    "Giỏ hàng không hợp lệ"
            );
        }


        Long userId =
                item
                        .getCart()
                        .getUser()
                        .getUserId();


        /*
         * quantity <= 0 -> xóa item.
         */
        if (quantity == null || quantity <= 0) {

            cartItemRepository.delete(item);
            cartItemRepository.flush();

            return getCart(userId);
        }


        ProductVariant variant = item.getVariant();

        if (variant == null) {
            throw new RuntimeException(
                    "Không tìm thấy biến thể sản phẩm"
            );
        }


        int stock =
                variant.getStock() == null
                        ? 0
                        : variant.getStock();


        if (stock <= 0) {
            throw new RuntimeException(
                    "Sản phẩm đã hết hàng"
            );
        }


        if (quantity > stock) {

            throw new RuntimeException(
                    "Chỉ còn " +
                    stock +
                    " sản phẩm trong kho"
            );
        }


        item.setQuantity(quantity);

        cartItemRepository.save(item);

        cartItemRepository.flush();

        return getCart(userId);
    }


    /*
     * =========================================================
     * REMOVE ITEM
     * =========================================================
     */
    @Transactional
    public void removeItem(Long itemId) {

        if (itemId == null) {
            throw new RuntimeException(
                    "Thiếu mã sản phẩm trong giỏ"
            );
        }

        CartItem item = cartItemRepository
                .findById(itemId)
                .orElseThrow(
                        () -> new RuntimeException(
                                "Không tìm thấy sản phẩm trong giỏ"
                        )
                );

        Cart cart = item.getCart();

        if (cart == null || cart.getItems() == null) {
            throw new RuntimeException(
                    "Giỏ hàng không hợp lệ"
            );
        }

        boolean removed = cart.getItems().removeIf(
                cartItem -> Objects.equals(
                        cartItem.getCartItemId(),
                        itemId
                )
        );

        if (!removed) {
            throw new RuntimeException(
                    "Không tìm thấy sản phẩm trong giỏ"
            );
        }

        cartRepository.saveAndFlush(cart);
    }


    /*
     * =========================================================
     * CLEAR CART
     * =========================================================
     */
    @Transactional
    public void clearCart(Long userId) {

        Cart cart = cartRepository
                .findByUser_UserId(userId)
                .orElse(null);

        if (cart == null) {
            return;
        }

        if (cart.getItems() == null) {
            return;
        }

        /*
         * Vì Cart đã có:
         *
         * cascade = CascadeType.ALL
         * orphanRemoval = true
         *
         * nên chỉ cần clear list.
         */
        cart.getItems().clear();

        cartRepository.save(cart);

        cartRepository.flush();
    }
}