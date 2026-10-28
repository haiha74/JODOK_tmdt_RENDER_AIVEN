package com.dacs.fashion.repository;

import com.dacs.fashion.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;


import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findByProductNameContaining(String keyword);

    List<Product> findByCategory_CategoryId(Long categoryId);

    @Modifying
    @Query(value = "DELETE FROM sale_event_products WHERE product_id = ?1", nativeQuery = true)
    int deleteSaleEventProductLinks(Long productId);

    @Modifying
    @Query(value = "DELETE FROM products WHERE product_id = ?1", nativeQuery = true)
    void deleteProductByIdNative(Long productId);

    @Query(value = """
        SELECT COALESCE(SUM(oi.quantity), 0)
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE pv.product_id = ?1
        AND o.order_status = 'COMPLETED'
    """, nativeQuery = true)
    Long getSoldCountByProductId(Long productId);
}