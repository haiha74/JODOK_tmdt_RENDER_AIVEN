package com.dacs.fashion.controller;

import com.dacs.fashion.dto.ProductDTO;
import com.dacs.fashion.entity.Product;
import com.dacs.fashion.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public List<Product> getAll(@RequestParam(required = false) Boolean all) {
        if (Boolean.TRUE.equals(all)) {
            return productService.getAllForAdmin();
        }

        return productService.getAll();
    }

    @GetMapping("/sold-counts")
    public Map<Long, Long> getAllSoldCounts() {
        return productService.getAllSoldCounts();
    }

    @GetMapping("/{id}/sold-count")
    public Long getSoldCount(@PathVariable Long id) {
        return productService.getSoldCount(id);
    }

    @GetMapping("/{id}")
    public Product getById(@PathVariable Long id) {
        return productService.getById(id);
    }

    @GetMapping("/search")
    public List<Product> search(@RequestParam String keyword) {
        return productService.search(keyword);
    }

    @GetMapping("/category/{categoryId}")
    public List<Product> getByCategory(@PathVariable Long categoryId) {
        return productService.getByCategory(categoryId);
    }

    @PostMapping
    public Product create(@RequestBody ProductDTO dto) {
        return productService.create(dto);
    }

    @PutMapping("/{id}")
    public Product update(@PathVariable Long id, @RequestBody ProductDTO dto) {
        return productService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    public String delete(@PathVariable Long id) {
        try {
            productService.delete(id);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Sản phẩm còn được dữ liệu khác tham chiếu. Vui lòng ẩn thay vì xóa.", ex);
        }
        return "Xóa sản phẩm thành công";
    }
}