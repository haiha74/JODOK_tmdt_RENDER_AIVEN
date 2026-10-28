package com.dacs.fashion.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "reviews")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long reviewId;

    @ManyToOne
    @JsonIgnoreProperties({
            "password",
            "email",
            "phone",
            "address",
            "role",
            "status",
            "orders",
            "reviews",
            "cart",
            "hibernateLazyInitializer",
            "handler"
    })
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @OneToOne
    @JsonIgnoreProperties({"order", "review"})
    @JoinColumn(name = "order_item_id", nullable = false)
    private OrderItem orderItem;

    private Integer rating;

    @Column(columnDefinition = "TEXT")
    private String comment;

    private String imageUrl;

    private LocalDateTime createdAt;
}