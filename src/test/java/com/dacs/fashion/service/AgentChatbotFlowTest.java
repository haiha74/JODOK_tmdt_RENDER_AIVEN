package com.dacs.fashion.service;

import com.dacs.fashion.ai.agent.JodokAgent;
import com.dacs.fashion.ai.groq.GroqClient;
import com.dacs.fashion.ai.tool.*;
import com.dacs.fashion.controller.ChatbotController;
import com.dacs.fashion.controller.ChatbotController.ChatResponse;
import com.dacs.fashion.entity.*;
import com.dacs.fashion.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Conversation integration tests use real tools and commerce services, isolated repository fixtures only. */
class AgentChatbotFlowTest {
    private final UserRepository users = mock(UserRepository.class);
    private final CartRepository carts = mock(CartRepository.class);
    private final CartItemRepository cartItems = mock(CartItemRepository.class);
    private final ProductRepository products = mock(ProductRepository.class);
    private final ProductVariantRepository variants = mock(ProductVariantRepository.class);
    private final OrderRepository orders = mock(OrderRepository.class);
    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final VoucherRepository vouchers = mock(VoucherRepository.class);
    private final GroqClient groq = mock(GroqClient.class);
    private final List<Product> catalog = new ArrayList<>();
    private final List<ProductVariant> stock = new ArrayList<>();
    private final Map<Long, Order> savedOrders = new LinkedHashMap<>();
    private User user;
    private Cart cart;
    private AgentChatbotService chatbot;
    private JodokAgent agent;
    private ProductTool productTool;
    private long nextItem = 100;

    @BeforeEach void setup() {
        user = User.builder().userId(7L).fullname("Nguyễn An").phone("0901234567")
                .address("10 Nguyễn Trãi, TP.HCM").status("ACTIVE").role("USER").build();
        cart = Cart.builder().cartId(1L).user(user).items(new ArrayList<>()).build();
        addProduct(1, "Áo thun nam A", "Áo nam", "Nike", "300000");
        addProduct(2, "Áo thun nam B", "Áo nam", "Nike", "310000");
        addProduct(3, "Áo thun nam C", "Áo nam", "Adidas", "290000");
        addProduct(4, "Giày cao gót mảnh", "Giày nữ", "Nike", "200000");
        addProduct(5, "Áo nữ", "Áo nữ", "Nike", "200000");
        when(products.findAll()).thenReturn(catalog);
        when(variants.findAll()).thenReturn(stock);
        when(variants.findByProduct_ProductId(anyLong())).thenAnswer(inv -> stock.stream()
                .filter(v -> Objects.equals(v.getProduct().getProductId(), inv.getArgument(0))).toList());
        when(variants.findById(anyLong())).thenAnswer(inv -> stock.stream()
                .filter(v -> Objects.equals(v.getVariantId(), inv.getArgument(0))).findFirst());
        when(users.findById(7L)).thenReturn(Optional.of(user));
        when(carts.findByUser_UserId(7L)).thenReturn(Optional.of(cart));
        when(carts.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(carts.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        when(cartItems.findByCartAndVariant(any(), any())).thenAnswer(inv -> cart.getItems().stream()
                .filter(i -> Objects.equals(i.getVariant().getVariantId(), ((ProductVariant) inv.getArgument(1)).getVariantId())).findFirst());
        when(cartItems.findById(anyLong())).thenAnswer(inv -> cart.getItems().stream()
                .filter(i -> Objects.equals(i.getCartItemId(), inv.getArgument(0))).findFirst());
        when(cartItems.save(any())).thenAnswer(inv -> {
            CartItem item = inv.getArgument(0);
            if (item.getCartItemId() == null) {
                item.setCartItemId(nextItem++);
                cart.getItems().add(item);
            }
            return item;
        });
        when(orders.save(any())).thenAnswer(inv -> {
            Order order = inv.getArgument(0);
            if (order.getOrderId() == null) order.setOrderId((long) savedOrders.size() + 20);
            savedOrders.put(order.getOrderId(), order);
            return order;
        });
        when(orders.findById(anyLong())).thenAnswer(inv -> Optional.ofNullable(savedOrders.get(inv.getArgument(0))));
        when(orders.findByUser_UserId(anyLong())).thenAnswer(inv -> savedOrders.values().stream()
                .filter(o -> Objects.equals(o.getUser().getUserId(), inv.getArgument(0))).toList());
        Voucher voucher = Voucher.builder().code("SAVE10").status("ACTIVE").discountType("PERCENT")
                .discountValue(new BigDecimal("10")).minOrderValue(new BigDecimal("400000"))
                .endDate(LocalDate.now().plusDays(1)).build();
        when(vouchers.findAll()).thenReturn(List.of(voucher));
        when(vouchers.findByCode("SAVE10")).thenReturn(Optional.of(voucher));
        VoucherService voucherService = new VoucherService(vouchers);
        CartService cartService = new CartService(carts, cartItems, users, variants);
        OrderService orderService = new OrderService(orders, users, carts, cartItems, variants, payments, voucherService);
        CartTool cartTool = new CartTool(cartService, variants);
        OrderTool orderTool = new OrderTool(orderService);
        productTool = new ProductTool(products, variants);
        agent = new JodokAgent(groq, new ObjectMapper(), productTool, cartTool, orderTool,
                new VoucherTool(vouchers, voucherService), new StylistTool(productTool));
        chatbot = new AgentChatbotService(agent, new CheckoutTool(cartTool, orderTool, orderService, users, variants));
    }

    private void addProduct(long id, String name, String category, String brand, String price) {
        Product product = Product.builder().productId(id).productName(name).status("ACTIVE")
                .category(Category.builder().categoryName(category).build())
                .brand(Brand.builder().brandName(brand).build()).basePrice(new BigDecimal(price)).build();
        catalog.add(product);
        stock.add(ProductVariant.builder().variantId(id * 10).product(product).size("M").color("Đen")
                .price(new BigDecimal(price)).stock(10).status("ACTIVE").build());
        stock.add(ProductVariant.builder().variantId(id * 10 + 1).product(product).size("L").color("Đen")
                .price(new BigDecimal(price)).stock(10).status("ACTIVE").build());
        stock.add(ProductVariant.builder().variantId(id * 10 + 2).product(product).size("L").color("Trắng")
                .price(new BigDecimal(price)).stock(0).status("ACTIVE").build());
    }

    private ChatResponse say(String message) { return chatbot.reply(message, "flow", 7L); }
    private ChatResponse prepareCheckout(String method) {
        say("Áo nam khoảng 300k");
        say("màu đen");
        say("cái thứ 2");
        say("size L");
        ChatResponse added = say("thêm 2 cái vào giỏ");
        assertNotNull(added.metadata().get("cart"), added.reply());
        say("thanh toán");
        say("Chọn địa chỉ 1");
        ChatResponse quote = say(method);
        assertEquals(true, quote.metadata().get("requiresConfirmation"), quote.reply());
        assertTrue(savedOrders.isEmpty());
        return quote;
    }

    @Test void requiredVietnameseConversationCreatesOnlyAfterConfirmationAndTracksRealOrder() throws Exception {
        ChatResponse search = say("Áo nam khoảng 300k");
        assertEquals(3, search.products().size());
        ChatResponse black = say("màu đen");
        assertEquals(3, black.products().size());
        Long second = black.products().get(1).productId();
        assertTrue(say("cái thứ 2").products().stream().allMatch(p -> p.productId().equals(second)));
        ChatResponse size = say("size L");
        assertEquals(1, size.products().size());
        assertEquals("L", size.products().get(0).size());
        assertEquals("Đen", size.products().get(0).color());
        say("thêm 2 cái vào giỏ");
        assertEquals(1, cart.getItems().size());
        assertEquals(2, cart.getItems().get(0).getQuantity());
        assertEquals(second, cart.getItems().get(0).getVariant().getProduct().getProductId());
        assertNotNull(say("xem giỏ hàng").metadata().get("cart"));
        ChatResponse eligible = say("có voucher nào dùng được không?");
        assertNotNull(eligible.metadata().get("vouchers"), eligible.reply());
        say("áp mã tốt nhất");
        ChatResponse checkout = say("thanh toán");
        assertNotNull(checkout.metadata().get("addresses"));
        assertNotNull(say("Chọn địa chỉ 1").metadata().get("checkout"));
        ChatResponse summary = say("COD");
        assertEquals(true, summary.metadata().get("requiresConfirmation"));
        Map<?, ?> quote = (Map<?, ?>) summary.metadata().get("checkout");
        assertEquals("CASH", quote.get("paymentMethod"));
        assertTrue(((BigDecimal) quote.get("discount")).signum() > 0);
        assertTrue(savedOrders.isEmpty());
        ChatResponse created = say("xác nhận");
        assertEquals("ORDER_CREATED", created.metadata().get("action"), created.reply());
        assertEquals(1, savedOrders.size());
        Order actual = savedOrders.values().iterator().next();
        assertEquals(7L, actual.getUser().getUserId());
        assertEquals(0, ((BigDecimal) quote.get("total")).compareTo(actual.getFinalAmount()));
        assertEquals("UNPAID", actual.getPayment().getPaymentStatus());
        assertTrue(cart.getItems().isEmpty());
        ChatResponse tracking = say("đơn của tôi đang ở đâu?");
        assertEquals(actual.getOrderId(), ((Map<?, ?>) ((List<?>) tracking.metadata().get("orders")).get(0)).get("orderId"));
        verify(groq, never()).callJson(anyString(), anyString(), anyInt());
    }

    @Test void regressionMensShirtAt200kNeverReturnsShoesWomenOrModelReply() {
        ChatResponse response = say("Áo nam khoảng 200k");
        assertFalse(response.products().isEmpty());
        assertTrue(response.products().stream().allMatch(p -> p.productName().startsWith("Áo thun nam")));
        assertFalse(response.reply().contains("Hey"));
        assertTrue(response.reply().contains("Mình"));
        assertTrue(response.reply().contains("gần mức giá"));
        assertTrue(response.products().stream().allMatch(p -> catalog.stream().anyMatch(real -> real.getProductId().equals(p.productId()))));
    }

    @Test void addRequiresExplicitVariantAndKeepsQuantityAcrossClarification() {
        say("Áo nam");
        say("cái thứ 1");
        ChatResponse needsOptions = say("thêm 2 cái");
        assertTrue(cart.getItems().isEmpty());
        assertTrue(needsOptions.reply().contains("màu"));
        say("size L");
        assertTrue(cart.getItems().isEmpty(), "Must not silently choose black by ignoring out-of-stock white");
        say("màu đen");
        assertEquals(2, cart.getItems().get(0).getQuantity());
        assertEquals("L", cart.getItems().get(0).getVariant().getSize());
        assertEquals("Đen", cart.getItems().get(0).getVariant().getColor());
    }

    @Test void askingAvailableColorsShowsRealAlternativesWithoutLosingSelectedVariant() {
        say("Áo nam màu đen");
        say("Cái thứ 1");
        say("Size L");
        ChatResponse colors = say("Áo này có màu gì?");
        assertTrue(colors.products().stream().anyMatch(p -> "Trắng".equals(p.color())));
        assertTrue(colors.products().stream().anyMatch(p -> "Đen".equals(p.color())));
        say("Thêm 2 cái");
        assertEquals("Đen", cart.getItems().get(0).getVariant().getColor());
    }

    @Test void comparisonCardsKeepOrdinalsAlignedForNextSelection() {
        ChatResponse search = say("Áo nam khoảng 300k");
        Long second = search.products().get(1).productId();
        ChatResponse compare = say("So sánh mẫu 2 và mẫu 3");
        assertEquals(2, compare.products().size());
        ChatResponse select = say("Chọn mẫu 1");
        assertTrue(select.products().stream().allMatch(p -> second.equals(p.productId())));
    }

    @Test void searchAndVariantSelectionUseTheSameColorMatchingRules() {
        stock.stream().filter(v -> v.getProduct().getProductId().equals(1L)).forEach(v -> v.setColor("Xanh navy"));
        ChatResponse search = say("Áo nam màu xanh");
        assertEquals(1, search.products().size());
        assertFalse(say("Cái thứ 1").products().isEmpty());
        say("Size M");
        say("Thêm 2 cái");
        assertEquals(1, cart.getItems().size());
        assertEquals("Xanh navy", cart.getItems().get(0).getVariant().getColor());
    }

    @Test void cartUpdateRemoveAndClearHaveNoAmbiguousConfirmation() {
        prepareCheckout("COD");
        say("Đổi thành 3");
        assertEquals(3, cart.getItems().get(0).getQuantity());
        say("Xóa hết giỏ");
        say("xác nhận đặt hàng");
        assertFalse(cart.getItems().isEmpty());
        assertTrue(savedOrders.isEmpty());
        say("xác nhận xóa");
        assertTrue(cart.getItems().isEmpty());
        prepareCheckout("COD");
        say("Xóa sản phẩm này");
        assertTrue(cart.getItems().isEmpty());
    }

    @Test void oldConfirmationCannotRunAfterAnotherTurnOrWithWrongToken() {
        ChatResponse summary = prepareCheckout("COD");
        String token = (String) summary.metadata().get("confirmationToken");
        say("xem giỏ hàng");
        chatbot.reply("xác nhận", "flow", 7L, token);
        assertTrue(savedOrders.isEmpty());
        ChatResponse next = say("thanh toán");
        assertEquals(true, next.metadata().get("requiresConfirmation"));
        chatbot.reply("xác nhận", "flow", 7L, "wrong-token");
        assertTrue(savedOrders.isEmpty());
        say("xác nhận");
        assertTrue(savedOrders.isEmpty());
    }

    @Test void priceChangeRequotesAndRequiresFreshConfirmation() {
        prepareCheckout("COD");
        ProductVariant selected = cart.getItems().get(0).getVariant();
        selected.setPrice(selected.getPrice().add(BigDecimal.TEN));
        ChatResponse changed = say("xác nhận");
        assertEquals(true, changed.metadata().get("requiresConfirmation"));
        assertTrue(changed.reply().contains("thay đổi"));
        assertTrue(savedOrders.isEmpty());
        say("xác nhận");
        assertEquals(1, savedOrders.size());
    }

    @Test void concurrentConfirmationCreatesOnlyOneOrder() throws Exception {
        ChatResponse summary = prepareCheckout("COD");
        String token = (String) summary.metadata().get("confirmationToken");
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            List<Future<ChatResponse>> results = executor.invokeAll(List.of(
                    () -> chatbot.reply("xác nhận", "flow", 7L, token),
                    () -> chatbot.reply("xác nhận", "flow", 7L, token)));
            for (Future<ChatResponse> result : results) assertNotNull(result.get(5, TimeUnit.SECONDS));
        } finally { executor.shutdownNow(); }
        assertEquals(1, savedOrders.size());
        verify(payments, times(1)).save(any());
    }

    @Test void qrCreatesOnlyPendingPaymentAndCustomerWordsNeverMarkPaid() {
        prepareCheckout("Thanh toán QR");
        ChatResponse created = say("xác nhận");
        assertNotNull(created.metadata().get("payment"), created.reply());
        Order actual = savedOrders.values().iterator().next();
        assertEquals("PENDING_PAYMENT", actual.getOrderStatus());
        assertEquals("PENDING", actual.getPayment().getPaymentStatus());
        say("Tôi thanh toán rồi");
        assertEquals("PENDING", actual.getPayment().getPaymentStatus());
        assertNotNull(say("Thanh toán đơn #" + actual.getOrderId()).metadata().get("payment"));
    }

    @Test void cancelNeedsSeparateConfirmationAndUsesExistingOrderService() {
        prepareCheckout("COD");
        say("xác nhận");
        Order order = savedOrders.values().iterator().next();
        int reserved = order.getItems().get(0).getVariant().getStock();
        ChatResponse pending = say("Hủy đơn");
        assertEquals(true, pending.metadata().get("requiresConfirmation"));
        say("xác nhận");
        assertEquals("PENDING", order.getOrderStatus());
        say("xác nhận hủy");
        assertEquals("CANCELLED", order.getOrderStatus());
        assertEquals(reserved + 2, order.getItems().get(0).getVariant().getStock());
    }

    @Test void anonymousAndCrossAccountRequestsCannotReadStateOrMutate() {
        prepareCheckout("COD");
        for (String message : List.of("Xem giỏ hàng", "Thanh toán", "Đơn hàng của tôi", "Địa chỉ của tôi", "COD", "Xác nhận")) {
            ChatResponse guest = chatbot.reply(message, "flow", null);
            assertEquals(true, guest.metadata().get("requiresLogin"), message + ": " + guest.reply());
        }
        chatbot.reply("Xác nhận", "flow", 8L);
        assertTrue(savedOrders.isEmpty());
        say("xác nhận");
        ChatResponse other = chatbot.reply("Đơn #20", "flow", 8L);
        assertFalse(other.metadata().containsKey("orders"));
        assertFalse(other.reply().contains(user.getAddress()));
    }

    @Test void controllerRetainsOldResponseAndRequestContractAndDerivesIdentity() throws Exception {
        AgentChatbotService service = mock(AgentChatbotService.class);
        when(service.reply(anyString(), anyString(), any(), any())).thenReturn(new ChatResponse("Xin chào", List.of()));
        ChatbotController controller = new ChatbotController(service);
        ObjectMapper mapper = new ObjectMapper();
        ChatbotController.ChatRequest legacy = mapper.readValue("{\"message\":\"Xem giỏ hàng\",\"conversationId\":\"old-client\"}",
                ChatbotController.ChatRequest.class);
        controller.message(legacy, new UsernamePasswordAuthenticationToken(user, null, List.of()));
        verify(service).reply("Xem giỏ hàng", "old-client", 7L, null);
        String json = mapper.writeValueAsString(new ChatResponse("Xin chào", List.of()));
        assertEquals("Xin chào", mapper.readTree(json).path("reply").asText());
        assertTrue(mapper.readTree(json).path("products").isArray());
    }

    @Test void emptyOrInvalidModelPlansAndDatabaseFailuresNeverExposeRawErrors() throws Exception {
        when(groq.callJson(anyString(), anyString(), anyInt())).thenThrow(new IllegalStateException("secret SQL api-key"));
        assertFalse(say("zqv hjkl").reply().contains("secret"));
        when(products.findAll()).thenThrow(new IllegalStateException("secret SQL api-key"));
        ChatResponse failure = say("Áo nam");
        assertFalse(failure.reply().contains("secret"));
        assertTrue(failure.products().isEmpty());
    }

    @Test void emptyCartUnavailableSizeSoldOutVariantAndExcessQuantityCannotCreateWrites() {
        assertTrue(say("Thanh toán").reply().contains("trống"));
        say("Áo nam màu đen");
        say("Cái thứ 1");
        ChatResponse missingSize = say("Còn size XL không?");
        assertTrue(missingSize.reply().contains("không có biến thể"));
        say("Thêm 2 cái");
        assertTrue(cart.getItems().isEmpty());
        say("size L màu trắng");
        ChatResponse soldOut = say("Thêm 2 cái");
        assertTrue(soldOut.reply().contains("hết hàng"), soldOut.reply());
        assertTrue(cart.getItems().isEmpty());
        say("size L màu đen");
        // A pending valid add can complete on the preceding explicit option selection.
        int before = cart.getItems().isEmpty() ? 0 : cart.getItems().get(0).getQuantity();
        ChatResponse excess = say("Thêm 999 cái");
        assertTrue(excess.reply().contains("chỉ còn"), excess.reply());
        assertEquals(before, cart.getItems().isEmpty() ? 0 : cart.getItems().get(0).getQuantity());
        assertTrue(savedOrders.isEmpty());
    }

    @Test void invalidExpiredAndDisabledVouchersNeverApplyToCheckout() {
        prepareCheckout("COD");
        Voucher expired = Voucher.builder().code("EXPIRED").status("ACTIVE").discountType("FIXED")
                .discountValue(BigDecimal.TEN).minOrderValue(BigDecimal.ZERO).endDate(LocalDate.now().minusDays(1)).build();
        Voucher disabled = Voucher.builder().code("LOCKED").status("INACTIVE").discountType("FIXED")
                .discountValue(BigDecimal.TEN).minOrderValue(BigDecimal.ZERO).build();
        when(vouchers.findByCode("EXPIRED")).thenReturn(Optional.of(expired));
        when(vouchers.findByCode("LOCKED")).thenReturn(Optional.of(disabled));
        for (String code : List.of("MISSING", "EXPIRED", "LOCKED")) {
            ChatResponse rejected = say("Áp mã " + code);
            assertTrue(rejected.reply().contains("Mã giảm giá không tồn tại, đã hết hạn"), rejected.reply());
            assertNull(agent.context("user:7:flow").getSelectedVoucher());
        }
        assertTrue(savedOrders.isEmpty());
    }

    @Test void groqTimeoutAndNullJsonHaveVietnameseFallbackWithoutSideEffects() throws Exception {
        when(groq.callJson(anyString(), anyString(), anyInt())).thenThrow(new java.net.SocketTimeoutException("timeout secret"));
        ChatResponse timeout = say("zqv hjkl");
        assertTrue(timeout.reply().startsWith("Mình"));
        assertFalse(timeout.reply().contains("secret"));
        doReturn(null).when(groq).callJson(anyString(), anyString(), anyInt());
        assertTrue(say("zqv hjkl").reply().startsWith("Mình"));
        assertTrue(savedOrders.isEmpty());
        assertTrue(cart.getItems().isEmpty());
    }
}
