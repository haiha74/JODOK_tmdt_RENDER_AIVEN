package com.dacs.fashion.repository;

import com.dacs.fashion.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {
    boolean existsByVariant_Product_ProductId(Long productId);
}