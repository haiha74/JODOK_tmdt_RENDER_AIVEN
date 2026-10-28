package com.dacs.fashion.ai.tool;

import com.dacs.fashion.dto.CartItemDTO;
import com.dacs.fashion.entity.Cart;
import com.dacs.fashion.entity.CartItem;
import com.dacs.fashion.entity.ProductVariant;
import com.dacs.fashion.repository.ProductVariantRepository;
import com.dacs.fashion.service.CartService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

@Component
public class CartTool {
    private final CartService cartService;
    private final ProductVariantRepository variantRepository;
    @PersistenceContext
    private EntityManager entityManager;
    public CartTool(CartService cartService, ProductVariantRepository variantRepository) {
        this.cartService = cartService;
        this.variantRepository = variantRepository;
    }

    public Cart view(Long userId) { requireUser(userId); return cartService.getCart(userId); }

    @Transactional
    public Cart add(Long userId, Long variantId, Integer quantity) {
        requireUser(userId);
        requireQuantity(quantity);
        if (variantId == null) throw new IllegalArgumentException("Vui lòng chọn đúng size và màu sản phẩm.");
        validateVariant(variantRepository.findById(variantId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy biến thể sản phẩm.")), quantity);
        CartItemDTO dto = new CartItemDTO(userId, variantId, quantity);
        Cart cart = cartService.addToCart(dto);
        // CartService persists the owning CartItem side. Refresh its already-loaded
        // inverse collection so this request's subsequent cart summary includes new rows.
        if (entityManager != null && entityManager.contains(cart)) {
            entityManager.flush();
            entityManager.refresh(cart);
        }
        return cart;
    }

    @Transactional
    public Cart update(Long userId, Long cartItemId, Integer quantity) {
        requireUser(userId); requireOwner(userId, cartItemId);
        requireQuantity(quantity);
        CartItem item = orderedItems(userId).stream()
                .filter(i -> cartItemId.equals(i.getCartItemId())).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Sản phẩm không còn trong giỏ hàng."));
        if (item.getVariant() == null) throw new IllegalArgumentException("Biến thể không còn tồn tại.");
        validateVariant(variantRepository.findById(item.getVariant().getVariantId())
                .orElseThrow(() -> new IllegalArgumentException("Biến thể không còn tồn tại.")), quantity);
        return cartService.updateQuantity(cartItemId, quantity);
    }

    public Cart remove(Long userId, Long cartItemId) {
        requireUser(userId); requireOwner(userId, cartItemId);
        cartService.removeItem(cartItemId);
        return cartService.getCart(userId);
    }

    public Cart clear(Long userId) {
        requireUser(userId); cartService.clearCart(userId); return cartService.getCart(userId);
    }

    public List<CartItem> orderedItems(Long userId) {
        Cart cart = view(userId);
        if (cart.getItems() == null) return List.of();
        return cart.getItems().stream()
                .sorted(Comparator.comparing(CartItem::getCartItemId, Comparator.nullsLast(Long::compareTo)))
                .toList();
    }

    private void requireOwner(Long userId, Long itemId) {
        if (itemId == null || !cartService.isItemOwner(itemId, userId))
            throw new SecurityException("Bạn không có quyền thao tác sản phẩm này trong giỏ.");
    }
    static void validateVariant(ProductVariant variant, Integer quantity) {
        requireQuantity(quantity);
        if (variant == null || !"ACTIVE".equalsIgnoreCase(variant.getStatus())
                || variant.getProduct() == null
                || !"ACTIVE".equalsIgnoreCase(variant.getProduct().getStatus()))
            throw new IllegalArgumentException("Sản phẩm hoặc biến thể hiện không hoạt động.");
        if (variant.getStock() == null || variant.getStock() < quantity)
            throw new IllegalArgumentException("Số lượng vượt quá tồn kho hiện có.");
        if (variant.getPrice() == null || variant.getPrice().signum() < 0)
            throw new IllegalArgumentException("Giá sản phẩm chưa hợp lệ.");
    }
    private static void requireQuantity(Integer quantity) {
        if (quantity == null || quantity <= 0)
            throw new IllegalArgumentException("Số lượng phải là số nguyên lớn hơn 0. Dùng thao tác xóa để bỏ sản phẩm.");
    }
    private void requireUser(Long userId) {
        if (userId == null) throw new SecurityException("Vui lòng đăng nhập để sử dụng giỏ hàng.");
    }
}
