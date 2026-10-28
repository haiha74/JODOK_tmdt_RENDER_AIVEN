package com.dacs.fashion.dto;

import lombok.*;
import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductDTO {

    private Long productId;
    private Long categoryId;
    private Long brandId;
    private String productName;
    private String description;
    private BigDecimal basePrice;
    private String status;
}