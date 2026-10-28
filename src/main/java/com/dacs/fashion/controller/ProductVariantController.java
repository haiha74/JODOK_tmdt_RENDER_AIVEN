package com.dacs.fashion.controller;

import com.dacs.fashion.dto.ProductVariantDTO;
import com.dacs.fashion.entity.ProductVariant;
import com.dacs.fashion.service.ProductVariantService;
import com.dacs.fashion.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import com.dacs.fashion.entity.User;

import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.ArrayList;

@RestController
@RequestMapping("/api/variants")
@RequiredArgsConstructor
public class ProductVariantController {

    private final ProductVariantService variantService;
    private final ProductVariantRepository variantRepository;

    @GetMapping
    public List<Map<String, Object>> getAll() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object[] row : variantRepository.findAdminVariantRows()) {
            Map<String, Object> variant = new LinkedHashMap<>();
            variant.put("variantId", row[0]);
            variant.put("productId", row[1]);
            variant.put("productName", row[2]);
            variant.put("product", Map.of("productId", row[1], "productName", row[2]));
            variant.put("size", row[3]);
            variant.put("color", row[4]);
            variant.put("sku", row[5]);
            variant.put("price", row[6]);
            variant.put("stock", row[7]);
            variant.put("status", row[8]);
            variant.put("updatedByStaff", row[9]);
            rows.add(variant);
        }
        return rows;
    }

    @GetMapping("/{id}")
    public ProductVariant getById(@PathVariable Long id) {
        return variantService.getById(id);
    }

    @GetMapping("/product/{productId}")
    public List<ProductVariant> getByProduct(@PathVariable Long productId) {
        return variantService.getByProduct(productId);
    }

    @PostMapping
    public ProductVariant create(@RequestBody ProductVariantDTO dto) {
        return variantService.create(dto);
    }

    @PutMapping("/{id}")
    public ProductVariant update(@PathVariable Long id,
                                @RequestBody ProductVariantDTO dto,
                                Authentication authentication) {
        User staff = (User) authentication.getPrincipal();

        return variantService.update(id, dto, staff.getFullname());
    }

    @DeleteMapping("/{id}")
    public String delete(@PathVariable Long id) {
        variantService.delete(id);
        return "Xóa biến thể thành công";
    }
}