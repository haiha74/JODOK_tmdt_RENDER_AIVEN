package com.dacs.fashion.ai.tool;

import com.dacs.fashion.entity.*;
import com.dacs.fashion.repository.*;
import com.dacs.fashion.service.CartService;
import com.dacs.fashion.service.OrderService;
import com.dacs.fashion.service.VoucherService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import jakarta.persistence.EntityManager;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Repository mocks keep tests isolated; pricing, cart, order and voucher business services are real. */
class CommerceToolsTest {
    private final UserRepository users = mock(UserRepository.class);
    private final CartRepository carts = mock(CartRepository.class);
    private final CartItemRepository cartItems = mock(CartItemRepository.class);
    private final ProductVariantRepository variants = mock(ProductVariantRepository.class);
    private final OrderRepository orders = mock(OrderRepository.class);
    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final VoucherRepository vouchers = mock(VoucherRepository.class);
    private User user;
    private Product product;
    private ProductVariant variant;
    private Cart cart;
    private CartItem cartItem;
    private CheckoutTool checkout;
    private CartTool cartTool;
    private OrderTool orderTool;
    private VoucherTool voucherTool;
    private OrderService orderService;

    @BeforeEach void setup() {
        user = User.builder().userId(7L).fullname("Nguyễn An").phone("0901234567")
                .address("10 Nguyễn Trãi, Quận 1, TP.HCM").status("ACTIVE").role("USER").build();
        product = Product.builder().productId(5L).productName("Áo thun").status("ACTIVE").build();
        variant = ProductVariant.builder().variantId(9L).product(product).size("M").color("Đen")
                .price(new BigDecimal("250000")).stock(10).status("ACTIVE").build();
        cart = Cart.builder().cartId(11L).user(user).items(new ArrayList<>()).build();
        cartItem = CartItem.builder().cartItemId(12L).cart(cart).variant(variant).quantity(2).build();
        cart.getItems().add(cartItem);
        when(users.findById(7L)).thenReturn(Optional.of(user));
        when(carts.findByUser_UserId(7L)).thenReturn(Optional.of(cart));
        when(cartItems.findById(12L)).thenReturn(Optional.of(cartItem));
        when(variants.findById(9L)).thenReturn(Optional.of(variant));
        when(orders.save(any())).thenAnswer(inv -> {
            Order order = inv.getArgument(0);
            if (order.getOrderId() == null) order.setOrderId(21L);
            return order;
        });
        VoucherService voucherService = new VoucherService(vouchers);
        orderService = new OrderService(orders, users, carts, cartItems, variants, payments, voucherService);
        CartService cartService = new CartService(carts, cartItems, users, variants);
        cartTool = new CartTool(cartService, variants);
        orderTool = new OrderTool(orderService);
        voucherTool = new VoucherTool(vouchers, voucherService);
        checkout = new CheckoutTool(cartTool, orderTool, orderService, users, variants);
    }

    @Test void quoteUsesSharedPricingAndDoesNotWriteOrderStockOrPayment() {
        CheckoutTool.Quote quote = checkout.quote(7L, null, null);
        assertEquals(new BigDecimal("500000"), quote.subtotal());
        assertEquals(new BigDecimal("30000"), quote.shipping());
        assertEquals(new BigDecimal("530000"), quote.total());
        assertNull(quote.paymentMethod());
        assertEquals(1, quote.address().get("id"));
        assertEquals(10, variant.getStock());
        verify(orders, never()).save(any());
        verify(payments, never()).save(any());
        verify(variants, never()).save(any());
        assertThrows(UnsupportedOperationException.class, () -> quote.items().get(0).put("price", 1));
    }

    @Test void confirmationCreatesRealCashOrderUsingCurrentServiceAndClearsCart() {
        CheckoutTool.Quote quote = checkout.quote(7L, null, "COD");
        Order order = checkout.create(7L, quote);
        assertEquals("PENDING", order.getOrderStatus());
        assertEquals(new BigDecimal("530000"), order.getFinalAmount());
        assertEquals(8, variant.getStock());
        assertTrue(cart.getItems().isEmpty());
        assertEquals("Nguyễn An | 0901234567 | 10 Nguyễn Trãi, Quận 1, TP.HCM", order.getAddress());
        verify(payments).save(argThat(p -> "CASH".equals(p.getPaymentMethod()) && "UNPAID".equals(p.getPaymentStatus())));
    }

    @Test void qrCheckoutRemainsPendingUntilExistingGatewayConfirmsPayment() {
        Order order = checkout.create(7L, checkout.quote(7L, null, "QR"));
        assertEquals("PENDING_PAYMENT", order.getOrderStatus());
        assertNotNull(order.getPayment());
        assertSame(order, order.getPayment().getOrder());
        assertEquals("QR", orderTool.summary(order).get("paymentMethod"));
        assertEquals("PENDING", orderTool.summary(order).get("paymentStatus"));
        verify(payments).save(argThat(p -> "QR".equals(p.getPaymentMethod())
                && "PENDING".equals(p.getPaymentStatus()) && p.getPaidAt() == null));
    }

    @Test void completedCheckoutCannotReplaySameQuoteAgainstEmptiedCart() {
        CheckoutTool.Quote quote = checkout.quote(7L, null, "CASH");
        checkout.create(7L, quote);
        assertThrows(IllegalStateException.class, () -> checkout.create(7L, quote));
        verify(orders, times(1)).save(any());
        verify(payments, times(1)).save(any());
    }

    @Test void cancellationRestoresReservedStockExactlyOnce() {
        Order order = Order.builder().orderId(21L).user(user).orderStatus("PENDING")
                .createdAt(LocalDateTime.now()).items(new ArrayList<>()).build();
        OrderItem orderedItem = new OrderItem();
        orderedItem.setOrder(order);
        orderedItem.setVariant(variant);
        orderedItem.setQuantity(2);
        orderedItem.setPrice(variant.getPrice());
        order.getItems().add(orderedItem);
        variant.setStock(8);
        when(orders.findById(21L)).thenReturn(Optional.of(order));
        orderTool.cancelMine(7L, 21L);
        assertEquals(10, variant.getStock());
        assertThrows(IllegalStateException.class, () -> orderTool.cancelMine(7L, 21L));
        assertEquals(10, variant.getStock());
        verify(variants, times(1)).save(variant);
    }

    @Test void changedPriceRequiresNewConfirmationBeforeAnyWrite() {
        CheckoutTool.Quote quote = checkout.quote(7L, null, "CASH");
        variant.setPrice(new BigDecimal("260000"));
        assertThrows(IllegalStateException.class, () -> checkout.create(7L, quote));
        verify(orders, never()).save(any());
        verify(payments, never()).save(any());
        assertEquals(10, variant.getStock());
    }

    @Test void changedRecipientOrCartQuantityInvalidatesQuote() {
        CheckoutTool.Quote quote = checkout.quote(7L, null, "CASH");
        user.setAddress("20 Lê Lợi");
        assertThrows(IllegalStateException.class, () -> checkout.create(7L, quote));
        CheckoutTool.Quote secondQuote = checkout.quote(7L, null, "CASH");
        cartItem.setQuantity(3);
        assertThrows(IllegalStateException.class, () -> checkout.create(7L, secondQuote));
        verify(orders, never()).save(any());
    }

    @Test void stockChangeWithEnoughRemainingDoesNotInvalidateQuote() {
        CheckoutTool.Quote quote = checkout.quote(7L, null, "CASH");
        variant.setStock(7);
        assertEquals(quote.fingerprint(), checkout.quote(7L, null, "CASH").fingerprint());
        checkout.create(7L, quote);
        assertEquals(5, variant.getStock());
    }

    @Test void staleStockAndInactiveProductFailBeforeCheckoutWrites() {
        CheckoutTool.Quote quote = checkout.quote(7L, null, "CASH");
        variant.setStock(1);
        assertThrows(IllegalArgumentException.class, () -> checkout.create(7L, quote));
        variant.setStock(10);
        product.setStatus("INACTIVE");
        assertThrows(IllegalArgumentException.class, () -> checkout.create(7L, quote));
        verify(orders, never()).save(any());
    }

    @Test void missingMethodProfileAndCrossUserQuoteCannotCreateOrder() {
        CheckoutTool.Quote noMethod = checkout.quote(7L, null, null);
        assertThrows(IllegalArgumentException.class, () -> checkout.create(7L, noMethod));
        CheckoutTool.Quote valid = checkout.quote(7L, null, "CASH");
        assertThrows(SecurityException.class, () -> checkout.create(8L, valid));
        user.setPhone("");
        assertTrue(checkout.addresses(7L).isEmpty());
        CheckoutTool.Quote incomplete = checkout.quote(7L, null, "CASH");
        assertThrows(IllegalStateException.class, () -> checkout.create(7L, incomplete));
        verify(orders, never()).save(any());
    }

    @Test void cartOwnerAndQuantityGuardsPreventCrossUserMutationAndImplicitRemoval() {
        assertThrows(SecurityException.class, () -> cartTool.remove(8L, 12L));
        assertThrows(SecurityException.class, () -> cartTool.update(8L, 12L, 2));
        assertThrows(IllegalArgumentException.class, () -> cartTool.update(7L, 12L, 0));
        assertThrows(IllegalArgumentException.class, () -> cartTool.add(7L, 9L, null));
        assertThrows(IllegalArgumentException.class, () -> cartTool.add(7L, 9L, -1));
        assertThrows(IllegalArgumentException.class, () -> cartTool.add(7L, 9L, 11));
        assertEquals(2, cartItem.getQuantity());
        verify(cartItems, never()).delete(any());
        verify(cartItems, never()).save(any());
    }

    @Test void newCartItemIsVisibleImmediatelyAfterRefreshingLoadedInverseCollection() {
        cart.getItems().clear();
        when(cartItems.findByCartAndVariant(cart, variant)).thenReturn(Optional.empty());
        AtomicReference<CartItem> persisted = new AtomicReference<>();
        when(cartItems.save(any())).thenAnswer(inv -> {
            CartItem item = inv.getArgument(0);
            item.setCartItemId(13L);
            persisted.set(item);
            // Owning-side persistence does not update an initialized inverse collection.
            assertTrue(cart.getItems().isEmpty());
            return item;
        });
        EntityManager entityManager = mock(EntityManager.class);
        ReflectionTestUtils.setField(cartTool, "entityManager", entityManager);
        when(entityManager.contains(cart)).thenReturn(true);
        doAnswer(inv -> {
            cart.getItems().add(persisted.get());
            return null;
        }).when(entityManager).refresh(cart);

        Cart result = cartTool.add(7L, 9L, 1);

        assertEquals(1, result.getItems().size());
        assertEquals(13L, cartTool.orderedItems(7L).get(0).getCartItemId());
        var refreshOrder = inOrder(entityManager);
        refreshOrder.verify(entityManager).flush();
        refreshOrder.verify(entityManager).refresh(cart);
        verify(entityManager, never()).clear();
    }

    @Test void malformedSavedPhoneIsNotOfferedForCheckoutSelection() {
        user.setPhone("123");
        assertTrue(checkout.addresses(7L).isEmpty());
        user.setPhone("0901234567");
        assertEquals(1, checkout.addresses(7L).size());
    }

    @Test void vouchersAreValidatedAgainstActualSubtotalAndCheckoutSharesTotals() {
        Voucher voucher = Voucher.builder().code("SAVE10").status("ACTIVE").discountType("PERCENT")
                .discountValue(new BigDecimal("10")).minOrderValue(new BigDecimal("400000"))
                .endDate(LocalDate.now().plusDays(2)).build();
        when(vouchers.findByCode("SAVE10")).thenReturn(Optional.of(voucher));
        when(vouchers.findAll()).thenReturn(List.of(voucher));
        assertEquals(voucher, voucherTool.validate("save10", new BigDecimal("500000")));
        assertTrue(voucherTool.eligible(new BigDecimal("100000")).isEmpty());
        CheckoutTool.Quote quote = checkout.quote(7L, "SAVE10", "CASH");
        assertEquals(0, new BigDecimal("50000").compareTo(quote.discount()));
        assertEquals(0, new BigDecimal("480000").compareTo(quote.total()));
        Order order = checkout.create(7L, quote);
        assertEquals(0, quote.total().compareTo(order.getFinalAmount()));
    }

    @Test void freeShippingThresholdAndDiscountClampRemainUnchanged() {
        assertEquals(BigDecimal.ZERO, orderService.calculatePricing(new BigDecimal("999000"), null).shipping());
        assertEquals(new BigDecimal("30000"), orderService.calculatePricing(new BigDecimal("998999"), null).shipping());
        Voucher voucher = Voucher.builder().code("GIFT").status("ACTIVE").discountType("FIXED")
                .discountValue(new BigDecimal("2000000")).minOrderValue(BigDecimal.ZERO).build();
        when(vouchers.findByCode("GIFT")).thenReturn(Optional.of(voucher));
        assertEquals(BigDecimal.ZERO, orderService.calculatePricing(new BigDecimal("500000"), "GIFT").total());
    }

    @Test void orderOwnershipCancellationAndPaymentStateAreEnforced() {
        Order order = Order.builder().orderId(21L).user(user).orderStatus("PENDING")
                .createdAt(LocalDateTime.now()).items(new ArrayList<>()).build();
        when(orders.findById(21L)).thenReturn(Optional.of(order));
        assertThrows(SecurityException.class, () -> orderTool.getMine(8L, 21L));
        for (String state : List.of("PAID", "CONFIRMED", "SHIPPING", "COMPLETED", "CANCELLED")) {
            order.setOrderStatus(state);
            assertThrows(IllegalStateException.class, () -> orderTool.cancelMine(7L, 21L));
        }
        order.setOrderStatus("PENDING_PAYMENT");
        Payment payment = Payment.builder().order(order).paymentMethod("QR").paymentStatus("PENDING").build();
        order.setPayment(payment);
        assertEquals(Map.of("orderId", 21L, "method", "QR", "status", "PENDING"), checkout.paymentAction(7L, 21L));
        payment.setPaymentStatus("PAID");
        assertThrows(IllegalStateException.class, () -> orderTool.cancelMine(7L, 21L));
        assertThrows(IllegalStateException.class, () -> checkout.paymentAction(7L, 21L));
        payment.setPaymentStatus("PENDING");
        assertEquals("CANCELLED", orderTool.cancelMine(7L, 21L).getOrderStatus());
        assertThrows(IllegalStateException.class, () -> orderTool.cancelMine(7L, 21L));
    }
}
