package com.dacs.fashion.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CheckoutDTO {
    private Long userId;
    private String fullname;
    private String phone;
    private String address;
    private String paymentMethod;
    private String voucherCode;
}