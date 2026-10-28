package com.dacs.fashion.ai.tool;

import com.dacs.fashion.entity.Voucher;
import com.dacs.fashion.repository.VoucherRepository;
import com.dacs.fashion.service.VoucherService;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Comparator;

@Component
public class VoucherTool {
    private final VoucherRepository voucherRepository;
    private final VoucherService voucherService;
    public VoucherTool(VoucherRepository voucherRepository, VoucherService voucherService) {
        this.voucherRepository = voucherRepository; this.voucherService = voucherService;
    }

    public List<Voucher> active() {
        LocalDate today = LocalDate.now();
        return voucherRepository.findAll().stream()
                .filter(v -> "ACTIVE".equalsIgnoreCase(v.getStatus()))
                .filter(v -> v.getEndDate() == null || !v.getEndDate().isBefore(today))
                .toList();
    }

    public Voucher validate(String code, BigDecimal orderValue) {
        if (code == null || code.isBlank()) throw new IllegalArgumentException("Thiếu mã voucher.");
        String canonical = active().stream().map(Voucher::getCode)
                .filter(c -> c != null && c.equalsIgnoreCase(code.trim())).findFirst().orElse(code.trim());
        return voucherService.validateVoucher(canonical, orderValue == null ? BigDecimal.ZERO : orderValue);
    }

    public List<Voucher> eligible(BigDecimal total) {
        BigDecimal amount = total == null ? BigDecimal.ZERO : total;
        return active().stream().filter(v -> {
            try { voucherService.validateVoucher(v.getCode(), amount); return true; }
            catch (RuntimeException ignored) { return false; }
        }).sorted(Comparator.comparing((Voucher v) -> discount(v, amount)).reversed()).toList();
    }

    public BigDecimal discount(Voucher voucher, BigDecimal total) {
        return voucherService.calculateDiscount(voucher, total);
    }
}
