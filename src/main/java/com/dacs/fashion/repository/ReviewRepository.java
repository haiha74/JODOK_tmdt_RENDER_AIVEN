package com.dacs.fashion.repository;

import com.dacs.fashion.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    List<Review> findAllByOrderByCreatedAtDesc();

    List<Review> findByUser_UserIdOrderByCreatedAtDesc(Long userId);

    // Lọc tại MySQL thay vì gửi toàn bộ reviews về trình duyệt.
    @Query("SELECT r FROM Review r JOIN r.orderItem oi JOIN oi.variant v WHERE v.product.productId = :productId ORDER BY r.createdAt DESC")
    List<Review> findByProductId(@Param("productId") Long productId);

    boolean existsByOrderItem_OrderItemId(Long orderItemId);
}