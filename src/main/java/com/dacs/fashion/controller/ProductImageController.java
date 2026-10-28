package com.dacs.fashion.controller;

import com.dacs.fashion.dto.ProductImageDTO;
import com.dacs.fashion.entity.Product;
import com.dacs.fashion.entity.ProductImage;
import com.dacs.fashion.repository.ProductImageRepository;
import com.dacs.fashion.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;

@RestController
@RequestMapping("/api/product-images")
@RequiredArgsConstructor
public class ProductImageController {

    private final ProductImageRepository productImageRepository;
    private final ProductRepository productRepository;

    @GetMapping("/product/{productId}")
    @Transactional(readOnly = true)
    public ResponseEntity<List<ProductImage>> getByProduct(@PathVariable Long productId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(productImageRepository.findByProduct_ProductId(productId));
    }

    @PostMapping
    @Transactional
    public ProductImage create(@RequestBody ProductImageDTO dto) {
        Product product = productRepository.findById(dto.getProductId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm"));
        ProductImage image = new ProductImage();
        image.setProduct(product);
        image.setImageUrl(dto.getImageUrl());
        image.setColor(dto.getColor() == null || dto.getColor().isBlank() ? null : dto.getColor().trim());
        image.setIsMain(dto.getIsMain() != null ? dto.getIsMain() : true);
        return productImageRepository.save(image);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        // ProductImage entity uses imageId as its primary key.
        ProductImage image = productImageRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy ảnh với imageId=" + id));
        productImageRepository.delete(image);
        productImageRepository.flush();
        // Verification against the database within the same transaction.
        if (productImageRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ảnh vẫn tồn tại sau khi xóa");
        }
        return ResponseEntity.noContent().build();
    }
}
