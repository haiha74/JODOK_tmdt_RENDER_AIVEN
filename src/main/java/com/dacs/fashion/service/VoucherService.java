package com.dacs.fashion.service;

import com.dacs.fashion.entity.Voucher;
import com.dacs.fashion.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class VoucherService {

    private final VoucherRepository voucherRepository;

    public Voucher validateVoucher(String code, BigDecimal orderValue){

        Voucher voucher = voucherRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("Voucher không tồn tại"));

        if(!"ACTIVE".equalsIgnoreCase(voucher.getStatus())){
            throw new RuntimeException("Voucher đã bị khóa");
        }

        if(voucher.getEndDate() != null &&
                voucher.getEndDate().isBefore(LocalDate.now())){
            throw new RuntimeException("Voucher đã hết hạn");
        }

        if(orderValue.compareTo(voucher.getMinOrderValue()) < 0){
            throw new RuntimeException(
                    "Đơn tối thiểu " + voucher.getMinOrderValue()
            );
        }

        return voucher;
    }

    public BigDecimal calculateDiscount(Voucher voucher, BigDecimal total){

        if("PERCENT".equalsIgnoreCase(voucher.getDiscountType())){

            return total.multiply(
                    voucher.getDiscountValue()
                            .divide(BigDecimal.valueOf(100))
            );
        }

        return voucher.getDiscountValue();
    }
}