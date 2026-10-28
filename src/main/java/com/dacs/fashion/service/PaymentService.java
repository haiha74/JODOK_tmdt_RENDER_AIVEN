package com.dacs.fashion.service;

import com.dacs.fashion.entity.Order;
import com.dacs.fashion.entity.Payment;
import com.dacs.fashion.repository.OrderRepository;
import com.dacs.fashion.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;


import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;

    public List<Payment> getAll() {
        return paymentRepository.findAll();
    }

    public Payment getById(Long id) {
        return paymentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thanh toán"));
    }

    public Payment create(Long orderId, String method) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng"));

        Payment payment = new Payment();
        payment.setOrder(order);
        payment.setPaymentMethod(method);
        payment.setPaymentStatus("UNPAID");

        return paymentRepository.save(payment);
    }

    public Payment updateStatus(Long id, String status) {
        Payment payment = getById(id);
        List<String> allowedStatus = List.of(
                "UNPAID",
                "PENDING",
                "PAID",
                "FAILED",
                "CANCELLED"
        );

        if (!allowedStatus.contains(status)) {
            throw new RuntimeException("Trạng thái thanh toán không hợp lệ");
        }
        payment.setPaymentStatus(status);

        if ("PAID".equals(status)) {
            payment.setPaidAt(LocalDateTime.now());
        }

        return paymentRepository.save(payment);
    }

    public void delete(Long id) {
        paymentRepository.deleteById(id);
    }
}