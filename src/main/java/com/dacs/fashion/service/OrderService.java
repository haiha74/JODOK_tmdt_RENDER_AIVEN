package com.dacs.fashion.service;

import com.dacs.fashion.dto.CheckoutDTO;
import com.dacs.fashion.dto.CreateOrderDTO;
import com.dacs.fashion.entity.*;
import com.dacs.fashion.repository.*;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.scheduling.annotation.Scheduled;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductVariantRepository variantRepository;
    private final PaymentRepository paymentRepository;
    private final VoucherService voucherService;
    private final SaleEventService saleEventService;
    

    public List<Order> getAll() {
        return orderRepository.findAll();
    }

    public List<Order> getByUser(Long userId) {
        return orderRepository.findByUser_UserId(userId);
    }

    public Order getById(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng"));
    }

    /** Shared authoritative pricing for checkout and chatbot previews. */
    public record Pricing(BigDecimal subtotal, BigDecimal shipping, BigDecimal discount,
                          BigDecimal total, Voucher voucher) {}

    public Pricing calculatePricing(BigDecimal subtotal, String voucherCode) {
        BigDecimal shipping = subtotal.compareTo(BigDecimal.valueOf(999000)) >= 0
                ? BigDecimal.ZERO : BigDecimal.valueOf(30000);
        Voucher voucher = null;
        BigDecimal discount = BigDecimal.ZERO;
        if (voucherCode != null && !voucherCode.isBlank()) {
            voucher = voucherService.validateVoucher(voucherCode, subtotal);
            discount = voucherService.calculateDiscount(voucher, subtotal);
        }
        return new Pricing(subtotal, shipping, discount,
                subtotal.add(shipping).subtract(discount).max(BigDecimal.ZERO), voucher);
    }

    @Transactional
    public Order createFromCart(CreateOrderDTO dto) {
        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy user"));

        Cart cart = cartRepository.findByUser_UserId(dto.getUserId())
                .orElseThrow(() -> new RuntimeException("Giỏ hàng trống"));

        if (cart.getItems() == null || cart.getItems().isEmpty()) {
            throw new RuntimeException("Giỏ hàng trống");
        }

        BigDecimal total = BigDecimal.ZERO;

        Order order = new Order();
        order.setUser(user);
        order.setAddress(dto.getAddress());
        order.setOrderStatus("PENDING");
        order.setCreatedAt(LocalDateTime.now());
        order.setDiscountAmount(BigDecimal.ZERO);

        List<OrderItem> orderItems = new ArrayList<>();
        // Snapshot promotion rules once for consistent prices and fewer DB round trips.
        List<SaleEvent> activeEvents = saleEventService.active();

        for (CartItem cartItem : cart.getItems()) {
            ProductVariant variant = variantRepository.findById(cartItem.getVariant().getVariantId())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy biến thể"));

            Integer quantity = cartItem.getQuantity();

            if (quantity == null || quantity <= 0) {
                throw new RuntimeException("Số lượng không hợp lệ");
            }

            if (!"ACTIVE".equalsIgnoreCase(variant.getStatus())) {
                throw new RuntimeException("Biến thể không hoạt động: " + variant.getSku());
            }

            if (variant.getStock() == null || variant.getStock() < quantity) {
                throw new RuntimeException("Không đủ tồn kho: " + variant.getSku());
            }

            BigDecimal price = saleEventService.price(variant.getProduct().getProductId(), variant.getPrice(), activeEvents);
            BigDecimal lineTotal = price.multiply(BigDecimal.valueOf(quantity));
            total = total.add(lineTotal);

            variant.setStock(variant.getStock() - quantity);
            variantRepository.save(variant);

            OrderItem orderItem = new OrderItem();
            orderItem.setOrder(order);
            orderItem.setVariant(variant);
            orderItem.setQuantity(quantity);
            orderItem.setPrice(price);

            orderItems.add(orderItem);
        }

        Pricing pricing = calculatePricing(total, dto.getVoucherCode());

        order.setTotalAmount(total);
        order.setDiscountAmount(pricing.discount());
        order.setFinalAmount(pricing.total());
        order.setVoucher(pricing.voucher());
        order.setItems(orderItems);

        Order savedOrder = orderRepository.save(order);

        cart.getItems().clear();
        cartRepository.save(cart);

        return savedOrder;
    }

    @Transactional
    public Order checkout(CheckoutDTO dto) {
        CreateOrderDTO createOrderDTO = new CreateOrderDTO();
        createOrderDTO.setUserId(dto.getUserId());
        createOrderDTO.setVoucherCode(dto.getVoucherCode());
        createOrderDTO.setAddress(
                dto.getFullname() + " | " + dto.getPhone() + " | " + dto.getAddress()
        );

        Order order = createFromCart(createOrderDTO);
        if ("QR".equalsIgnoreCase(dto.getPaymentMethod())) {
            order.setOrderStatus("PENDING_PAYMENT");
            orderRepository.save(order);
        }

        Payment payment = new Payment();
        payment.setOrder(order);
        payment.setPaymentMethod(dto.getPaymentMethod());
        payment.setPaymentStatus(
                "QR".equalsIgnoreCase(dto.getPaymentMethod()) ? "PENDING" : "UNPAID"
        );
        payment.setPaidAt(null);

        paymentRepository.save(payment);
        order.setPayment(payment);

        return order;
    }

    @Transactional
    public Order updateStatus(Long orderId, String status, String staffName) {
        List<String> allowedStatus = List.of(
                "PENDING",
                "PENDING_PAYMENT",
                "PAID",
                "CONFIRMED",
                "SHIPPING",
                "COMPLETED",
                "CANCELLED"
        );

        if (!allowedStatus.contains(status)) {
            throw new RuntimeException("Trạng thái đơn hàng không hợp lệ");
        }

        Order order = getById(orderId);
        String oldStatus = order.getOrderStatus();

        if ("CANCELLED".equals(status) && !"CANCELLED".equals(oldStatus)) {
            if (order.getItems() != null) {
                for (OrderItem item : order.getItems()) {
                    ProductVariant variant = item.getVariant();

                    if (variant != null) {
                        variant.setStock(
                                (variant.getStock() == null ? 0 : variant.getStock())
                                        + item.getQuantity()
                        );

                        variantRepository.save(variant);
                    }
                }
            }

            if (order.getPayment() != null) {
                order.getPayment().setPaymentStatus("CANCELLED");
                paymentRepository.save(order.getPayment());
            }
        }

        order.setOrderStatus(status);
        order.setUpdatedByStaff(staffName);
        return orderRepository.save(order);
    }

    @Transactional
    public Order markPaid(Long id) {
        Order order = orderRepository.findById(id).orElseThrow();

        order.setOrderStatus("PAID");

        if(order.getPayment() != null){
            order.getPayment().setPaymentStatus("PAID");
            order.getPayment().setPaidAt(LocalDateTime.now());
            paymentRepository.save(order.getPayment());
        }

        return orderRepository.save(order);
    }

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cancelExpiredPayOSOrders() {

        LocalDateTime expiredTime = LocalDateTime.now().minusMinutes(5);

        List<Order> orders = orderRepository.findByOrderStatusAndCreatedAtBefore("PENDING_PAYMENT", expiredTime);

        for (Order order : orders) {

            if ("PENDING_PAYMENT".equals(order.getOrderStatus())
                    && order.getCreatedAt().isBefore(expiredTime)) {

                order.setOrderStatus("CANCELLED");

                if (order.getItems() != null) {
                    for (OrderItem item : order.getItems()) {
                        ProductVariant variant = item.getVariant();

                        if (variant != null) {
                            variant.setStock(
                                    (variant.getStock() == null ? 0 : variant.getStock())
                                            + item.getQuantity()
                            );

                            variantRepository.save(variant);
                        }
                    }
                }

                if (order.getPayment() != null) {
                    order.getPayment().setPaymentStatus("CANCELLED");
                    paymentRepository.save(order.getPayment());
                }

                orderRepository.save(order);
            }
        }
    }
}
