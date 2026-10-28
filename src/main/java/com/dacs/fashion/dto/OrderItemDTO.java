package com.dacs.fashion.dto;

import lombok.*;
import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItemDTO {

    private Long variantId;
    private Integer quantity;
    private BigDecimal unitPrice;
}