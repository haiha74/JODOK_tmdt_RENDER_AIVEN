package com.dacs.fashion.repository;

import com.dacs.fashion.entity.ProductView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ProductViewRepository extends JpaRepository<ProductView, Long> {

    List<ProductView> findByUser_UserId(Long userId);

    @Modifying
    @Query(
        value = "DELETE FROM product_views WHERE product_id = ?1",
        nativeQuery = true
    )
    void deleteByProductId(Long productId);
}