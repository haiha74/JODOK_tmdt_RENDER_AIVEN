package com.dacs.fashion.repository;

import com.dacs.fashion.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;


import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findByProductNameContaining(String keyword);

    List<Product> findByCategory_CategoryId(Long categoryId);

    // Tải sản phẩm ACTIVE cùng ảnh/danh mục/thương hiệu trong một truy vấn.
    // Tránh N+1 SQL queries khi dữ liệu đặt ở Aiven xa máy chủ Render.
    @Query("""
        SELECT DISTINCT p FROM Product p
        LEFT JOIN FETCH p.images
        LEFT JOIN FETCH p.category
        LEFT JOIN FETCH p.brand
        WHERE p.status = 'ACTIVE'
    """)
    List<Product> findAllActiveWithCatalogDetails();

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

    // Một truy vấn cho tất cả sản phẩm, thay vì hàng trăm truy vấn riêng lẻ.
    // Chỉ đếm đơn COMPLETED, giữ đúng logic của getSoldCountByProductId.
    @Query(value = """
        SELECT pv.product_id, COALESCE(SUM(oi.quantity), 0)
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.order_status = 'COMPLETED'
        GROUP BY pv.product_id
    """, nativeQuery = true)
    List<Object[]> findAllSoldCounts();
}