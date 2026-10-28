package com.dacs.fashion.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "product_images")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long imageId;

    @ManyToOne
    @JoinColumn(name = "product_id", nullable = false)
    @JsonIgnoreProperties({"images", "variants"})
    private Product product;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "color", length = 100)
    private String color;

    @Column(name = "is_main")
    private Boolean isMain;
}