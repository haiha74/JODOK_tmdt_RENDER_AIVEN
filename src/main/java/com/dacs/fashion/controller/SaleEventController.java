package com.dacs.fashion.controller;

import com.dacs.fashion.entity.SaleEvent;
import com.dacs.fashion.repository.ProductRepository;
import com.dacs.fashion.service.SaleEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class SaleEventController {

    private final SaleEventService service;
    private final ProductRepository products;

    @GetMapping
    public List<SaleEvent> active() {
        return service.active();
    }

    @GetMapping("/{slug}")
    public Map<String, Object> detail(@PathVariable String slug) {
        SaleEvent event = service.bySlug(slug);
        return Map.of("event", event, "products", products.findAllById(event.getProductIds()));
    }

    @GetMapping("/prices")
    public Map<Long, BigDecimal> prices() {
        Map<Long, BigDecimal> result = new HashMap<>();
        for (var product : products.findAll()) {
            if (product.getBasePrice() != null) {
                result.put(product.getProductId(),
                        service.price(product.getProductId(), product.getBasePrice()));
            }
        }
        return result;
    }

    @GetMapping("/admin/all")
    public List<SaleEvent> all() {
        return service.all();
    }

    @PostMapping("/admin")
    public SaleEvent create(@RequestBody SaleEvent event) {
        return service.save(null, event);
    }

    @PutMapping("/admin/{id}")
    public SaleEvent update(@PathVariable Long id, @RequestBody SaleEvent event) {
        return service.save(id, event);
    }

    @DeleteMapping("/admin/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    // Trả trực tiếp 400/404/409 cho API thay vì chuyển lỗi qua /error.
    // Không thay đổi các quy tắc phân quyền trong SecurityConfig.
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleEventValidation(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of(
                "message", ex.getReason() == null ? "Yêu cầu không hợp lệ" : ex.getReason()
        ));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleEventDatabaseConflict(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "message", "Không thể lưu sự kiện do dữ liệu trùng hoặc không thỏa ràng buộc cơ sở dữ liệu"
        ));
    }
}