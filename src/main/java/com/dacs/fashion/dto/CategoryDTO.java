package com.dacs.fashion.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CategoryDTO {

    private Long categoryId;
    private Long parentId;
    private String categoryName;
    private String description;
    private String status;
    private String imageUrl;
}