package com.dacs.fashion.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "product_views")
public class ProductView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long viewId;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(name = "product_id")
    private Product product;

    private LocalDateTime viewedAt = LocalDateTime.now();

    public Long getViewId() { return viewId; }
    public User getUser() { return user; }
    public Product getProduct() { return product; }
    public LocalDateTime getViewedAt() { return viewedAt; }

    public void setViewId(Long viewId) { this.viewId = viewId; }
    public void setUser(User user) { this.user = user; }
    public void setProduct(Product product) { this.product = product; }
    public void setViewedAt(LocalDateTime viewedAt) { this.viewedAt = viewedAt; }
}