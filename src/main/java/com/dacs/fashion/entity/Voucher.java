package com.dacs.fashion.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "vouchers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Voucher {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long voucherId;

    private String code;

    private String discountType;

    private BigDecimal discountValue;

    private LocalDate endDate;

    private BigDecimal minOrderValue;

    private Integer startDate;

    private String status;
}