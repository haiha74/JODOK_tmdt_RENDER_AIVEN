package com.dacs.fashion.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProductImageDTO {

    private Long productId;
    private String imageUrl;
    private Boolean isMain;
    private String color;
}