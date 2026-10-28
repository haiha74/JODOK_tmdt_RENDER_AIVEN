package com.dacs.fashion.repository;

import com.dacs.fashion.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.time.LocalDateTime;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUser_UserId(Long userId);
    List<Order> findByOrderStatusAndCreatedAtBefore(String status, LocalDateTime cutoff);
}