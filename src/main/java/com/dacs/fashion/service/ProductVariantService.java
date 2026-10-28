package com.dacs.fashion.service;

import com.dacs.fashion.dto.ProductVariantDTO;
import com.dacs.fashion.entity.Product;
import com.dacs.fashion.entity.ProductVariant;
import com.dacs.fashion.repository.ProductRepository;
import com.dacs.fashion.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductVariantService {

    private final ProductVariantRepository variantRepository;
    private final ProductRepository productRepository;

    public List<ProductVariant> getAll() {
        return variantRepository.findAll();
    }

    public ProductVariant getById(Long id) {
        return variantRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy biến thể sản phẩm"));
    }

    public List<ProductVariant> getByProduct(Long productId) {
        return variantRepository.findByProduct_ProductId(productId)
                .stream()
                .filter(v -> "ACTIVE".equals(v.getStatus()))
                .toList();
    }

    public ProductVariant create(ProductVariantDTO dto) {
        Product product = productRepository.findById(dto.getProductId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy sản phẩm"));

        ProductVariant variant = new ProductVariant();
        variant.setProduct(product);
        variant.setSize(dto.getSize());
        variant.setColor(dto.getColor());
        variant.setSku(dto.getSku());
        variant.setPrice(dto.getPrice());
        variant.setStock(dto.getStock());
        variant.setStatus(dto.getStatus() == null ? "ACTIVE" : dto.getStatus());

        return variantRepository.save(variant);
    }

    public ProductVariant update(Long id, ProductVariantDTO dto, String staffName) {
        ProductVariant variant = getById(id);

        if (dto.getProductId() != null) {
            Product product = productRepository.findById(dto.getProductId())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy sản phẩm"));
            variant.setProduct(product);
        }

        variant.setSize(dto.getSize());
        variant.setColor(dto.getColor());
        variant.setSku(dto.getSku());
        variant.setPrice(dto.getPrice());
        if (dto.getStock() != null && dto.getStock() < 0) {
            throw new RuntimeException("Tồn kho không được âm");
        }
        variant.setStock(dto.getStock());
        variant.setStatus(dto.getStatus());

        variant.setUpdatedByStaff(staffName);
        return variantRepository.save(variant);
    }

    public void delete(Long id) {
        ProductVariant variant = getById(id);
        variantRepository.delete(variant);
    }
}