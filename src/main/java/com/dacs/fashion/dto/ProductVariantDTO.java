package com.dacs.fashion.dto;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProductVariantDTO {

    private Long productId;

    private String size;

    private String color;

    private String sku;

    private BigDecimal price;

    private Integer stock;

    private String status;
}