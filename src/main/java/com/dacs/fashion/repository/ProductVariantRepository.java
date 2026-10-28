package com.dacs.fashion.repository;

import com.dacs.fashion.entity.ProductVariant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {

    List<ProductVariant> findByProduct_ProductId(Long productId);

    // Fetch only columns required by admin table; avoid eager nested Product JSON.
    @Query("select v.variantId, p.productId, p.productName, v.size, v.color, v.sku, " +
           "v.price, v.stock, v.status, v.updatedByStaff " +
           "from ProductVariant v join v.product p")
    List<Object[]> findAdminVariantRows();

    @Modifying
    @Query(value = "DELETE FROM product_variants WHERE product_id = ?1", nativeQuery = true)
    void deleteByProductId(Long productId);
}