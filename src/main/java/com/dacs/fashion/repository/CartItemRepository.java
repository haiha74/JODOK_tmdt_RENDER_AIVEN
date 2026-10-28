package com.dacs.fashion.repository;

import com.dacs.fashion.entity.Cart;
import com.dacs.fashion.entity.CartItem;
import com.dacs.fashion.entity.ProductVariant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {

    Optional<CartItem> findByCartAndVariant(Cart cart, ProductVariant variant);

    @Modifying
    @Query(value = "DELETE FROM cart_items WHERE cart_item_id = ?1", nativeQuery = true)
    void deleteCartItemByIdNative(Long cartItemId);

    @Modifying
    @Query(value = """
            DELETE FROM cart_items
            WHERE variant_id IN (
                SELECT variant_id FROM product_variants WHERE product_id = ?1
            )
            """, nativeQuery = true)
    void deleteByProductId(Long productId);
}