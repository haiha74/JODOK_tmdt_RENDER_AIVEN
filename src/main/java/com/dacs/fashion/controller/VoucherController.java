package com.dacs.fashion.controller;

import com.dacs.fashion.entity.Voucher;
import com.dacs.fashion.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/vouchers")
@RequiredArgsConstructor
public class VoucherController {
    private final VoucherRepository voucherRepository;

    @GetMapping
    public ResponseEntity<?> getAll() {
        return ResponseEntity.ok(voucherRepository.findAll());
    }

    private String validate(Voucher v, Long editingId) {
        if (v.getCode() == null || v.getCode().isBlank()) return "Mã voucher không được trống";
        if (!"PERCENT".equals(v.getDiscountType()) && !"FIXED".equals(v.getDiscountType())) return "Loại giảm không hợp lệ";
        if (v.getDiscountValue() == null || v.getDiscountValue().compareTo(BigDecimal.ZERO) <= 0) return "Giá trị giảm phải lớn hơn 0";
        if ("PERCENT".equals(v.getDiscountType()) && v.getDiscountValue().compareTo(BigDecimal.valueOf(100)) > 0) return "Phần trăm giảm tối đa là 100%";
        if (v.getMinOrderValue() == null || v.getMinOrderValue().compareTo(BigDecimal.ZERO) < 0) return "Đơn tối thiểu không hợp lệ";
        if (v.getEndDate() != null && v.getEndDate().isBefore(LocalDate.now())) return "Ngày hết hạn không được ở quá khứ";
        if (!"ACTIVE".equals(v.getStatus()) && !"INACTIVE".equals(v.getStatus())) return "Trạng thái không hợp lệ";
        return voucherRepository.findByCode(v.getCode()).filter(existing -> editingId == null || !existing.getVoucherId().equals(editingId))
                .map(existing -> "Mã voucher đã tồn tại").orElse(null);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Voucher voucher) {
        voucher.setVoucherId(null);
        if (voucher.getCode() != null) voucher.setCode(voucher.getCode().trim().toUpperCase());
        String error = validate(voucher, null);
        if (error != null) return ResponseEntity.badRequest().body(Map.of("message", error));
        return ResponseEntity.status(HttpStatus.CREATED).body(voucherRepository.save(voucher));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Voucher data) {
        var found = voucherRepository.findById(id);
        if (found.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Không tìm thấy voucher"));
        if (data.getCode() != null) data.setCode(data.getCode().trim().toUpperCase());
        String error = validate(data, id);
        if (error != null) return ResponseEntity.badRequest().body(Map.of("message", error));
        Voucher v = found.get();
        v.setCode(data.getCode());
        v.setDiscountType(data.getDiscountType());
        v.setDiscountValue(data.getDiscountValue());
        v.setEndDate(data.getEndDate());
        v.setMinOrderValue(data.getMinOrderValue());
        v.setStatus(data.getStatus());
        return ResponseEntity.ok(voucherRepository.save(v));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!voucherRepository.existsById(id)) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Không tìm thấy voucher"));
        voucherRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
