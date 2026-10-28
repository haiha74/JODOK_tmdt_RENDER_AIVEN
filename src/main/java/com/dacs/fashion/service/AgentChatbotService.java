package com.dacs.fashion.service;

import com.dacs.fashion.ai.agent.AgentContext;
import com.dacs.fashion.ai.agent.AgentPlan;
import com.dacs.fashion.ai.agent.JodokAgent;
import com.dacs.fashion.ai.tool.CheckoutTool;
import com.dacs.fashion.ai.tool.ProductTool;
import com.dacs.fashion.controller.ChatbotController.ChatProduct;
import com.dacs.fashion.controller.ChatbotController.ChatResponse;
import com.dacs.fashion.entity.CartItem;
import com.dacs.fashion.entity.Order;
import com.dacs.fashion.entity.ProductVariant;
import com.dacs.fashion.entity.Voucher;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

/** Executes only server-validated plans; the model never supplies commerce data or authorization. */
@Service
public class AgentChatbotService {
    private static final long CONFIRMATION_TTL = 5 * 60 * 1000L;
    private final JodokAgent agent;
    private final CheckoutTool checkoutTool;
    // Same user is serialized across conversations, including repeated confirmation requests.
    private final Object[] locks = new Object[128];

    public AgentChatbotService(JodokAgent agent, CheckoutTool checkoutTool) {
        this.agent = agent;
        this.checkoutTool = checkoutTool;
        Arrays.setAll(locks, i -> new Object());
    }

    public ChatResponse reply(String message, String conversationId, Long userId) {
        return reply(message, conversationId, userId, null);
    }

    public ChatResponse reply(String message, String conversationId) { return reply(message, conversationId, null); }
    public ChatResponse reply(String message) { return reply(message, UUID.randomUUID().toString(), null); }

    public ChatResponse reply(String message, String conversationId, Long userId, String confirmationToken) {
        if (blank(message)) return response("Bạn nhập yêu cầu mua sắm nhé.");
        String cid = (userId == null ? "guest:" : "user:" + userId + ":")
                + (blank(conversationId) ? UUID.randomUUID() : conversationId.trim());
        Object lock = locks[Math.floorMod(Objects.hashCode(userId == null ? cid : userId), locks.length)];
        synchronized (lock) {
            AgentContext state = agent.context(cid);
            state.touch();
            try {
                String normalized = normalize(message);
                if (isConfirmation(normalized)) return confirm(state, userId, normalized, confirmationToken);
                // Every new non-confirmation turn invalidates the previous consent.
                state.clearConfirmation();
                if (Set.of("thoi", "khong", "bo qua", "huy thao tac", "khong dat nua").contains(normalized)) {
                    state.setPendingCartAdd(false);
                    state.setCheckoutStarted(false);
                    return response("Mình đã bỏ thao tác đang chờ xác nhận.");
                }

                AgentPlan plan = agent.plan(message.trim(), cid, userId);
                if (plan == null || blank(plan.action())) return help();
                String action = plan.action().toUpperCase(Locale.ROOT);
                if (requiresUser(action) && userId == null) return login();
                state.setLastIntent(action);

                return switch (action) {
                    case "PRODUCT_SEARCH", "PRODUCT_RECOMMEND" -> search(plan, state);
                    case "PRODUCT_BRANDS" -> response("Các thương hiệu đang có: "
                            + String.join(", ", agent.productTool().getCatalogInfo().brands()) + ".");
                    case "PRODUCT_DETAIL", "PRODUCT_VARIANTS", "PRODUCT_STOCK", "VARIANT_CHECK" -> detail(plan, state, userId, message);
                    case "COMPARE" -> compare(plan, state);
                    case "STYLIST", "OUTFIT" -> outfit(plan, state, message);
                    case "CART_VIEW" -> cart(userId, state, "Giỏ hàng của bạn:");
                    case "CART_ADD" -> add(plan, userId, state);
                    case "CART_UPDATE", "CART_REMOVE" -> changeCart(plan, userId, state, action);
                    case "CART_CLEAR" -> prepareClear(userId, state);
                    case "VOUCHER_LIST" -> vouchers(userId);
                    case "VOUCHER_CHECK", "VOUCHER_APPLY" -> voucher(plan, userId, state, action, message);
                    case "CHECKOUT_SUMMARY", "ORDER_CREATE" -> checkout(plan, userId, state);
                    case "ADDRESS_LIST", "ADDRESS_SELECT" -> address(plan, userId, state, action);
                    case "PAYMENT_METHODS", "PAYMENT_SELECT" -> paymentMethods(plan, userId, state);
                    case "PAYMENT_CREATE" -> payment(plan, userId, state);
                    case "ORDER_LIST" -> orders(plan, userId, state);
                    case "ORDER_DETAIL", "ORDER_STATUS", "ORDER_VIEW" -> order(plan, userId, state);
                    case "ORDER_LATEST" -> {
                        state.setSelectedOrderId(null);
                        yield order(plan, userId, state);
                    }
                    case "ORDER_CANCEL" -> prepareCancel(plan, userId, state);
                    case "GREETING", "HELP", "CHAT", "UNKNOWN", "ASK_CLARIFICATION" -> help();
                    default -> help();
                };
            } catch (CustomerInput ex) {
                return response(ex.getMessage());
            } catch (SecurityException ex) {
                state.clearConfirmation();
                return userId == null ? login()
                        : response("Mình không tìm thấy dữ liệu thuộc tài khoản của bạn cho yêu cầu này.");
            } catch (Exception ex) {
                state.clearConfirmation();
                // Never expose exception text: repositories and HTTP clients can contain SQL or secrets.
                return response("Mình chưa thể thực hiện yêu cầu. Vui lòng kiểm tra lại giỏ hàng, tồn kho, mã giảm giá và thông tin nhận hàng rồi thử lại.");
            }
        }
    }

    private ChatResponse search(AgentPlan plan, AgentContext state) {
        state.setPendingCartAdd(false);
        state.setCheckoutStarted(false);
        state.setLastSearchRequest(plan);
        state.selectProduct(null);
        if (Boolean.TRUE.equals(plan.sale()) && !agent.productTool().supportsSales()) {
            state.clearProducts();
            return response("Danh mục hiện chưa có dữ liệu giá sale riêng. Bạn có thể hỏi mã giảm giá hoặc tìm sản phẩm theo ngân sách.");
        }
        List<ProductTool.ProductCandidate> products = agent.productTool().search(new ProductTool.SearchRequest(
                plan.productType(), plan.audience(), plan.minPrice(), plan.maxPrice(), plan.targetPrice(),
                plan.size(), plan.color(), plan.brand(), plan.occasion(), plan.style(),
                plan.stock() == null ? true : plan.stock(), plan.limit() == null ? 8 : plan.limit(),
                plan.keyword(), plan.category(), plan.sale(), plan.sort()));
        String text = "Mình tìm thấy " + products.size() + " sản phẩm phù hợp. Bạn chọn theo số mẫu để xem tiếp nhé.";
        if (plan.targetPrice() != null && !products.isEmpty()) {
            BigDecimal tolerance = plan.targetPrice().multiply(new BigDecimal("0.20"));
            List<ProductTool.ProductCandidate> near = products.stream()
                    .filter(p -> p.price().subtract(plan.targetPrice()).abs().compareTo(tolerance) <= 0).toList();
            if (near.isEmpty()) {
                text = "Mình chưa tìm thấy sản phẩm đúng các điều kiện trong khoảng giá " + money(plan.targetPrice())
                        + ". Dưới đây là các lựa chọn gần mức giá này, vẫn giữ loại sản phẩm, giới tính, thương hiệu, màu và size bạn yêu cầu.";
            } else {
                products = near;
                text = "Mình tìm thấy " + products.size() + " sản phẩm phù hợp. Bạn chọn theo số mẫu để xem tiếp nhé.";
            }
        }
        rememberProducts(state, products);
        if (products.isEmpty()) text = "Mình chưa tìm thấy sản phẩm khớp các điều kiện bạn yêu cầu. Bạn có thể đổi ngân sách, màu hoặc size.";
        return new ChatResponse(text, cards(products));
    }

    private ChatResponse detail(AgentPlan plan, AgentContext state, Long userId, String message) {
        Long productId = selectProduct(plan, state);
        if (productId == null) return response("Bạn chọn một mẫu trong kết quả tìm kiếm trước nhé.");
        selectOptions(plan, state);
        String question = normalize(message);
        boolean listColors = question.contains("mau gi") || question.contains("mau nao");
        boolean listSizes = question.contains("size gi") || question.contains("size nao");
        List<ProductTool.ProductCandidate> variants = agent.productTool().getVariants(productId).stream()
                .filter(v -> listSizes || agent.productTool().matchesSize(v.size(), state.getSelectedSize()))
                .filter(v -> listColors || agent.productTool().matchesColor(v.color(), state.getSelectedColor())).toList();
        if (variants.isEmpty()) {
            state.setSelectedVariantId(null);
            return new ChatResponse("Mẫu này không có biến thể đúng màu/size bạn chọn. Các biến thể hiện có:",
                    cards(agent.productTool().getVariants(productId)), variantMetadata(state));
        }
        if (variants.size() == 1) state.setSelectedVariantId(variants.get(0).variantId());
        if (state.getPendingCartAdd() && !listColors && !listSizes) {
            if (userId == null) return login();
            return add(plan, userId, state);
        }
        String text = "Thông tin " + variants.get(0).productName() + ":\n"
                + variants.stream().map(v -> "Size " + display(v.size()) + ", màu " + display(v.color())
                        + ": " + money(v.price()) + " — " + (v.stock() > 0 ? "còn " + v.stock() : "hết hàng"))
                .collect(Collectors.joining("\n"));
        if ("PRODUCT_DETAIL".equalsIgnoreCase(plan.action()) && !blank(variants.get(0).description())) {
            text += "\n" + variants.get(0).description();
        }
        // Keep original product ordinals: variant cards are explicitly about the selected product.
        return new ChatResponse(text, cards(variants), variantMetadata(state));
    }

    private ChatResponse compare(AgentPlan plan, AgentContext state) {
        List<ProductTool.ProductCandidate> selected = new ArrayList<>();
        if (plan.referenceIndexes() != null) for (Integer index : plan.referenceIndexes()) {
            Long id = at(state.getLastProductIds(), index);
            if (id != null && selected.stream().noneMatch(p -> p.productId().equals(id))) {
                agent.productTool().getVariants(id).stream().findFirst().ifPresent(selected::add);
            }
        }
        if (selected.size() < 2) return response("Bạn chọn ít nhất hai mẫu, ví dụ “so sánh mẫu 1 và mẫu 2”.");
        state.selectProduct(null);
        state.setPendingCartAdd(false);
        rememberProducts(state, selected);
        return new ChatResponse("So sánh theo dữ liệu hiện tại:\n" + selected.stream()
                .map(p -> p.productName() + ": " + money(p.price()) + ", thương hiệu " + display(p.brand())
                        + ", size " + display(p.size()) + ", màu " + display(p.color()))
                .collect(Collectors.joining("\n")), cards(selected));
    }

    private ChatResponse outfit(AgentPlan plan, AgentContext state, String message) {
        if (blank(plan.audience()) && state.getSelectedProductId() != null && state.getLastSearchRequest() != null) {
            plan = plan.toBuilder().audience(state.getLastSearchRequest().audience()).build();
        }
        // A specifically requested complementary garment still uses all hard search filters.
        if (!blank(plan.productType())) return search(plan, state);
        ProductTool.ProductCandidate anchor = null;
        String request = normalize(message);
        if (state.getSelectedProductId() != null && (request.contains("voi") || request.contains("nay"))) {
            anchor = matchingVariants(state).stream().findFirst().orElse(null);
        }
        state.selectProduct(null);
        state.setPendingCartAdd(false);
        List<ProductTool.ProductCandidate> products = agent.stylistTool().candidates(
                plan.audience(), plan.totalBudget() == null ? plan.maxPrice() : plan.totalBudget(),
                plan.color(), plan.occasion(), plan.style(), anchor);
        rememberProducts(state, products);
        BigDecimal total = products.stream().map(ProductTool.ProductCandidate::price).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new ChatResponse(products.isEmpty() ? "Mình chưa tìm được món đồ phù hợp ngân sách để phối."
                : "Bạn có thể phối các món dưới đây theo tông màu hài hòa. Tổng giá sản phẩm gợi ý: "
                + money(total) + " (chưa gồm vận chuyển và voucher).", cards(products));
    }

    private ChatResponse add(AgentPlan plan, Long userId, AgentContext state) {
        Long productId = selectProduct(plan, state);
        if (productId == null) return response("Bạn tìm và chọn sản phẩm trước khi thêm vào giỏ nhé.");
        selectOptions(plan, state);
        if (plan.quantity() != null) {
            if (plan.quantity() <= 0) throw input("Số lượng phải là số nguyên lớn hơn 0.");
            state.setSelectedQuantity(plan.quantity());
        }
        List<ProductTool.ProductCandidate> variants = matchingVariants(state);
        // A model-provided variant must belong to the selected product and explicit options.
        if (plan.variantId() != null && variants.stream().noneMatch(v -> v.variantId().equals(plan.variantId()))) {
            throw input("Biến thể không thuộc mẫu hoặc màu/size bạn đang chọn.");
        }
        if (variants.isEmpty()) {
            state.setPendingCartAdd(true);
            state.setSelectedVariantId(null);
            return new ChatResponse("Mẫu này không có màu/size bạn yêu cầu. Bạn chọn lại từ các biến thể hiện có nhé.",
                    cards(agent.productTool().getVariants(productId)), variantMetadata(state));
        }
        // Do not choose an available option by discarding out-of-stock alternatives.
        if (variants.size() > 1) {
            state.setPendingCartAdd(true);
            return new ChatResponse("Bạn chọn rõ màu và size trước khi thêm giỏ nhé.\nMàu: "
                    + variants.stream().map(ProductTool.ProductCandidate::color).map(AgentChatbotService::display).distinct().collect(Collectors.joining(", "))
                    + ". Size: " + variants.stream().map(ProductTool.ProductCandidate::size).map(AgentChatbotService::display).distinct().collect(Collectors.joining(", ")) + ".",
                    cards(variants), variantMetadata(state));
        }
        ProductTool.ProductCandidate chosen = variants.get(0);
        int quantity = state.getSelectedQuantity() == null ? 1 : state.getSelectedQuantity();
        if (chosen.stock() < quantity) {
            return response("Size " + display(chosen.size()) + " màu " + display(chosen.color())
                    + (chosen.stock() == 0 ? " hiện đã hết hàng." : " chỉ còn " + chosen.stock() + " sản phẩm."));
        }
        agent.cartTool().add(userId, chosen.variantId(), quantity);
        state.setSelectedVariantId(chosen.variantId());
        state.setSelectedQuantity(1);
        state.setPendingCartAdd(false);
        List<CartItem> items = agent.cartTool().orderedItems(userId);
        items.stream().filter(i -> i.getVariant().getVariantId().equals(chosen.variantId())).findFirst()
                .ifPresent(i -> state.setSelectedCartItemId(i.getCartItemId()));
        return cart(userId, state, "Đã thêm " + quantity + " × " + chosen.productName() + " vào giỏ.");
    }

    private ChatResponse cart(Long userId, AgentContext state, String text) {
        List<CartItem> items = agent.cartTool().orderedItems(userId);
        rememberCart(state, items);
        Map<String, Object> data = cartData(items);
        return response(items.isEmpty() ? "Giỏ hàng của bạn đang trống." : text,
                map("cart", data, "action", "CART_VIEW", "actions", items.isEmpty() ? List.of() : List.of(
                        action("Thanh toán", "Thanh toán"), action("Mã giảm giá", "Có voucher nào dùng được không?"))));
    }

    private ChatResponse changeCart(AgentPlan plan, Long userId, AgentContext state, String action) {
        List<CartItem> items = agent.cartTool().orderedItems(userId);
        Long id = plan.cartItemId();
        if (id != null && !state.getLastCartItemIds().contains(id) && !Objects.equals(id, state.getSelectedCartItemId())) {
            throw input("Bạn xem giỏ hàng và chọn đúng dòng sản phẩm cần sửa nhé.");
        }
        if (id == null && first(plan) != null) id = at(state.getLastCartItemIds(), first(plan));
        final Long selectedId = id;
        boolean explicitDescription = !blank(plan.productType()) || !blank(plan.keyword());
        List<CartItem> matches = items.stream().filter(i -> selectedId != null
                ? Objects.equals(i.getCartItemId(), selectedId)
                : explicitDescription
                    ? (blank(plan.productType()) || normalize(i.getVariant().getProduct().getProductName()).contains(normalize(plan.productType())))
                        && (blank(plan.keyword()) || normalize(i.getVariant().getProduct().getProductName()).contains(normalize(plan.keyword())))
                : state.getSelectedCartItemId() != null
                    ? Objects.equals(i.getCartItemId(), state.getSelectedCartItemId())
                    : state.getSelectedProductId() != null
                        ? Objects.equals(i.getVariant().getProduct().getProductId(), state.getSelectedProductId())
                        : blank(plan.productType()) || normalize(i.getVariant().getProduct().getProductName()).contains(normalize(plan.productType())))
                .filter(i -> agent.productTool().matchesSize(i.getVariant().getSize(), plan.size()))
                .filter(i -> agent.productTool().matchesColor(i.getVariant().getColor(), plan.color())).toList();
        if (matches.size() != 1) return cart(userId, state, "Bạn chọn đúng một dòng, ví dụ “xóa mẫu 2 khỏi giỏ” hoặc “đổi mẫu 2 thành 3”.");
        CartItem item = matches.get(0);
        if ("CART_REMOVE".equals(action)) {
            agent.cartTool().remove(userId, item.getCartItemId());
            state.setSelectedCartItemId(null);
        } else {
            if (plan.quantity() == null || plan.quantity() <= 0) throw input("Bạn muốn đổi số lượng thành bao nhiêu? Số lượng phải lớn hơn 0.");
            agent.cartTool().update(userId, item.getCartItemId(), plan.quantity());
            state.setSelectedCartItemId(item.getCartItemId());
        }
        return cart(userId, state, "Đã cập nhật giỏ hàng.");
    }

    private ChatResponse prepareClear(Long userId, AgentContext state) {
        List<CartItem> items = agent.cartTool().orderedItems(userId);
        if (items.isEmpty()) return cart(userId, state, "");
        prepare(state, "CLEAR_CART");
        state.setPendingCartSnapshot(cartSnapshot(items));
        return confirmation("Bạn có chắc muốn xóa toàn bộ giỏ hàng không?", state, map("cart", cartData(items)));
    }

    private ChatResponse vouchers(Long userId) {
        BigDecimal total = userId == null ? null : subtotal(agent.cartTool().orderedItems(userId));
        List<Voucher> vouchers = total == null ? agent.voucherTool().active() : agent.voucherTool().eligible(total);
        List<Map<String, Object>> rows = vouchers.stream().map(v -> map("code", v.getCode(),
                "discount", total == null ? null : agent.voucherTool().discount(v, total),
                "discountType", v.getDiscountType(), "discountValue", v.getDiscountValue(),
                "minOrderValue", v.getMinOrderValue(), "endDate", v.getEndDate())).toList();
        return response(rows.isEmpty() ? "Hiện chưa có mã giảm giá phù hợp với giỏ hàng."
                : total == null ? "Các mã giảm giá hiện có; đăng nhập để kiểm tra với giỏ hàng của bạn."
                : "Các mã dùng được với giá trị giỏ hàng hiện tại:", map("vouchers", rows));
    }

    private ChatResponse voucher(AgentPlan plan, Long userId, AgentContext state, String action, String message) {
        if (userId == null) return login();
        BigDecimal total = subtotal(agent.cartTool().orderedItems(userId));
        if (total.signum() <= 0) return response("Bạn thêm sản phẩm vào giỏ trước khi kiểm tra mã giảm giá nhé.");
        String code = plan.voucherCode();
        if (blank(code) && !normalize(message).contains("tot nhat")) {
            return response("Bạn gửi mã giảm giá muốn kiểm tra hoặc nói “áp mã tốt nhất” nhé.");
        }
        if (blank(code) || Set.of("BEST", "TOT_NHAT", "TỐT NHẤT").contains(code.toUpperCase(Locale.ROOT))) {
            List<Voucher> eligible = agent.voucherTool().eligible(total);
            if (eligible.isEmpty()) return response("Chưa có mã nào dùng được cho giỏ hàng này.");
            code = eligible.stream().max(Comparator.comparing(v -> agent.voucherTool().discount(v, total))).orElseThrow().getCode();
        }
        Voucher voucher;
        try { voucher = agent.voucherTool().validate(code, total); }
        catch (RuntimeException ex) { throw input("Mã giảm giá không tồn tại, đã hết hạn hoặc chưa đủ điều kiện với giỏ hàng hiện tại."); }
        BigDecimal discount = agent.voucherTool().discount(voucher, total);
        if ("VOUCHER_APPLY".equals(action)) {
            state.setSelectedVoucher(voucher.getCode());
            if (state.isCheckoutStarted()) return checkout(plan, userId, state);
        }
        return response(("VOUCHER_APPLY".equals(action) ? "Đã chọn mã " : "Mã ")
                + voucher.getCode() + " giảm " + money(discount)
                + ". Mã sẽ được kiểm tra lại khi xác nhận đặt hàng.");
    }

    private ChatResponse checkout(AgentPlan plan, Long userId, AgentContext state) {
        state.setCheckoutStarted(true);
        if (agent.cartTool().orderedItems(userId).isEmpty()) return response("Giỏ hàng đang trống. Bạn thêm sản phẩm trước nhé.");
        if (!blank(plan.paymentMethod())) state.setSelectedPaymentMethod(paymentMethod(plan.paymentMethod()));
        List<Map<String, Object>> addresses = checkoutTool.addresses(userId);
        if (addresses.isEmpty()) return response("Bạn cần bổ sung họ tên, số điện thoại và địa chỉ giao hàng trong tài khoản.",
                map("actions", List.of(link("Cập nhật địa chỉ", "/account"))));
        if (state.getSelectedAddressId() == null) {
            return response("Bạn chọn địa chỉ nhận hàng trong hồ sơ để tiếp tục thanh toán nhé.",
                    map("addresses", addresses, "actions", List.of(action("Chọn địa chỉ 1", "Chọn địa chỉ 1"))));
        }
        CheckoutTool.Quote quote = checkoutTool.quote(userId, state.getSelectedVoucher(), state.getSelectedPaymentMethod());
        if (blank(state.getSelectedPaymentMethod())) {
            return response("Đây là tổng tiền hiện tại. Bạn chọn COD hoặc thanh toán online qua PayOS nhé.",
                    map("checkout", checkoutTool.asMap(quote), "actions", paymentChoices()));
        }
        prepare(state, "CREATE_ORDER");
        state.setPendingQuote(quote);
        return confirmation("Bạn kiểm tra thông tin đơn hàng bên dưới. Gửi “xác nhận” để đặt đơn này.", state, map("checkout", checkoutTool.asMap(quote)));
    }

    private ChatResponse address(AgentPlan plan, Long userId, AgentContext state, String action) {
        List<Map<String, Object>> addresses = checkoutTool.addresses(userId);
        if (addresses.isEmpty()) return response("Hồ sơ chưa có đủ thông tin giao hàng. Bạn cập nhật tại trang tài khoản nhé.",
                map("actions", List.of(link("Cập nhật địa chỉ", "/account"))));
        if ("ADDRESS_SELECT".equals(action)) {
            Integer index = plan.addressIndex() == null ? first(plan) : plan.addressIndex();
            if (!Objects.equals(index, 1)) return response("Tài khoản hiện chỉ lưu một địa chỉ. Bạn chọn địa chỉ 1 hoặc sửa trong tài khoản.",
                    map("addresses", addresses, "actions", List.of(link("Sửa địa chỉ", "/account"))));
            state.setSelectedAddressId(1);
            if (state.isCheckoutStarted()) return checkout(plan, userId, state);
            return response("Đã chọn địa chỉ trong hồ sơ.", map("addresses", addresses));
        }
        state.setSelectedAddressId(null);
        return response("Địa chỉ trong tài khoản của bạn:", map("addresses", addresses,
                "actions", List.of(action("Chọn địa chỉ 1", "Chọn địa chỉ 1"), link("Sửa địa chỉ", "/account"))));
    }

    private ChatResponse paymentMethods(AgentPlan plan, Long userId, AgentContext state) {
        if (!blank(plan.paymentMethod())) {
            state.setSelectedPaymentMethod(paymentMethod(plan.paymentMethod()));
            if (state.isCheckoutStarted()) return checkout(plan, userId, state);
            return response("Đã chọn " + ("CASH".equals(state.getSelectedPaymentMethod()) ? "COD (trả khi nhận hàng)." : "PayOS (thanh toán online)."),
                    map("actions", List.of(action("Xem tổng đơn", "Thanh toán"))));
        }
        return response("Website hỗ trợ COD và thanh toán online qua PayOS.", map("actions", paymentChoices()));
    }

    private ChatResponse orders(AgentPlan plan, Long userId, AgentContext state) {
        List<Order> orders = agent.orderTool().listMine(userId);
        if (!blank(plan.orderStatus())) orders = orders.stream()
                .filter(o -> plan.orderStatus().equalsIgnoreCase(o.getOrderStatus())).toList();
        orders = orders.stream().limit(10).toList();
        if (orders.isEmpty()) return response("Bạn chưa có đơn hàng phù hợp.");
        state.setSelectedOrderId(orders.get(0).getOrderId());
        return response("Các đơn hàng của bạn:", map("orders", orders.stream().map(agent.orderTool()::summary).toList()));
    }

    private ChatResponse order(AgentPlan plan, Long userId, AgentContext state) {
        Order order = resolveOrder(plan, userId, state);
        state.setSelectedOrderId(order.getOrderId());
        return response("Thông tin đơn hàng từ hệ thống:", map("orders", List.of(agent.orderTool().summary(order))));
    }

    private ChatResponse prepareCancel(AgentPlan plan, Long userId, AgentContext state) {
        Order order = resolveOrder(plan, userId, state);
        if (!Set.of("PENDING", "PENDING_PAYMENT").contains(order.getOrderStatus())) {
            return response("Chỉ đơn đang chờ xác nhận hoặc chờ thanh toán mới có thể hủy qua chatbot.");
        }
        state.setSelectedOrderId(order.getOrderId());
        prepare(state, "CANCEL_ORDER");
        state.setPendingOrderId(order.getOrderId());
        return confirmation("Bạn có chắc muốn hủy đơn #" + order.getOrderId() + "? Gửi “xác nhận hủy” để tiếp tục.",
                state, map("orders", List.of(agent.orderTool().summary(order))));
    }

    private ChatResponse payment(AgentPlan plan, Long userId, AgentContext state) {
        Order order = resolveOrder(plan, userId, state);
        return response("Bạn có thể mở PayOS để thanh toán đơn này. Trạng thái được lấy từ hệ thống.",
                map("orders", List.of(agent.orderTool().summary(order)),
                        "payment", checkoutTool.paymentAction(userId, order.getOrderId())));
    }

    private ChatResponse confirm(AgentContext state, Long userId, String text, String token) {
        if (userId == null) return login();
        String pending = state.getPendingAction();
        if (pending == null) return response("Không có thao tác nào đang chờ xác nhận. Bạn xem lại giỏ hàng hoặc đơn hàng trước nhé.");
        if (System.currentTimeMillis() - state.getConfirmationCreatedAt() > CONFIRMATION_TTL
                || (token != null && !Objects.equals(token, state.getConfirmationToken()))) {
            state.clearConfirmation();
            return response("Yêu cầu xác nhận đã hết hạn hoặc đã thay đổi. Bạn xem lại thông tin trước khi xác nhận nhé.");
        }
        boolean cancelWords = text.contains("huy");
        boolean clearWords = text.contains("xoa");
        boolean createWords = text.contains("dat");
        if ((cancelWords && !"CANCEL_ORDER".equals(pending)) || (clearWords && !"CLEAR_CART".equals(pending))
                || (createWords && !"CREATE_ORDER".equals(pending))
                || ("CANCEL_ORDER".equals(pending) && !cancelWords)) {
            return response("Nội dung xác nhận chưa khớp thao tác đang chờ. Bạn kiểm tra lại yêu cầu nhé.");
        }
        CheckoutTool.Quote quote = state.getPendingQuote();
        Long orderId = state.getPendingOrderId();
        String cartSnapshot = state.getPendingCartSnapshot();
        // Consume before side effects. A retry cannot create another order.
        state.clearConfirmation();
        if ("CLEAR_CART".equals(pending)) {
            if (!Objects.equals(cartSnapshot, cartSnapshot(agent.cartTool().orderedItems(userId)))) {
                return prepareClear(userId, state);
            }
            agent.cartTool().clear(userId);
            state.clearCart();
            return response("Đã xóa toàn bộ giỏ hàng.");
        }
        if ("CANCEL_ORDER".equals(pending)) {
            Order cancelled = agent.orderTool().cancelMine(userId, orderId);
            return response("Đã hủy đơn #" + cancelled.getOrderId() + ".", map("orders", List.of(agent.orderTool().summary(cancelled))));
        }
        if (!"CREATE_ORDER".equals(pending) || quote == null) return response("Bạn bắt đầu thanh toán lại để xem tổng đơn nhé.");
        CheckoutTool.Quote current = checkoutTool.quote(userId, state.getSelectedVoucher(), state.getSelectedPaymentMethod());
        if (!Objects.equals(current.fingerprint(), quote.fingerprint())) {
            prepare(state, "CREATE_ORDER");
            state.setPendingQuote(current);
            return confirmation("Giỏ hàng, giá hoặc thông tin nhận hàng đã thay đổi. Bạn xem tổng đơn mới và xác nhận lại nhé.",
                    state, map("checkout", checkoutTool.asMap(current)));
        }
        Order created = checkoutTool.create(userId, quote);
        state.setSelectedOrderId(created.getOrderId());
        state.setCheckoutStarted(false);
        state.setSelectedVoucher(null);
        state.clearCart();
        Map<String, Object> metadata = map("orders", List.of(agent.orderTool().summary(created)), "action", "ORDER_CREATED");
        if ("QR".equals(quote.paymentMethod())) {
            try {
                metadata.put("payment", checkoutTool.paymentAction(userId, created.getOrderId()));
            } catch (RuntimeException ex) {
                metadata.put("actions", List.of(action("Thử lại thanh toán", "Thanh toán đơn #" + created.getOrderId())));
            }
        }
        return response("Đã tạo đơn #" + created.getOrderId() + ("QR".equals(quote.paymentMethod())
                ? ". Bạn mở PayOS bên dưới để thanh toán. Đơn chưa được xác nhận thanh toán thành công."
                : ". Bạn thanh toán khi nhận hàng."), metadata);
    }

    private Order resolveOrder(AgentPlan plan, Long userId, AgentContext state) {
        Long id = plan.orderId() == null ? state.getSelectedOrderId() : plan.orderId();
        if (id == null) {
            List<Order> orders = agent.orderTool().listMine(userId);
            if (orders.isEmpty()) throw input("Bạn chưa có đơn hàng nào.");
            id = orders.get(0).getOrderId();
        }
        return agent.orderTool().getMine(userId, id);
    }

    private Long selectProduct(AgentPlan plan, AgentContext state) {
        Long id = first(plan) == null ? plan.productId() : at(state.getLastProductIds(), first(plan));
        if (first(plan) != null && id == null) throw input("Số mẫu không có trong kết quả vừa hiển thị.");
        if (id != null && !state.getLastProductIds().contains(id) && !Objects.equals(id, state.getSelectedProductId())) {
            throw input("Bạn chọn một sản phẩm trong kết quả tìm kiếm trước nhé.");
        }
        if (id == null) id = state.getSelectedProductId();
        if (id != null) {
            state.selectProduct(id);
            if (state.getLastSearchRequest() != null) {
                if (state.getSelectedColor() == null) state.setSelectedColor(state.getLastSearchRequest().color());
                if (state.getSelectedSize() == null) state.setSelectedSize(state.getLastSearchRequest().size());
            }
        }
        return id;
    }

    private void selectOptions(AgentPlan plan, AgentContext state) {
        if (!blank(plan.color())) { state.setSelectedColor(plan.color()); state.setSelectedVariantId(null); }
        if (!blank(plan.size())) { state.setSelectedSize(plan.size()); state.setSelectedVariantId(null); }
    }

    private Map<String, Object> variantMetadata(AgentContext state) {
        return map("productMode", "variants", "selectedProductId", state.getSelectedProductId());
    }

    private List<ProductTool.ProductCandidate> matchingVariants(AgentContext state) {
        if (state.getSelectedProductId() == null) return List.of();
        return agent.productTool().getVariants(state.getSelectedProductId()).stream()
                .filter(v -> agent.productTool().matchesSize(v.size(), state.getSelectedSize()))
                .filter(v -> agent.productTool().matchesColor(v.color(), state.getSelectedColor())).toList();
    }

    private void rememberProducts(AgentContext state, List<ProductTool.ProductCandidate> products) {
        state.clearProducts();
        products.forEach(p -> { state.getLastProductIds().add(p.productId()); state.getLastVariantIds().add(p.variantId()); });
    }

    private void rememberCart(AgentContext state, List<CartItem> items) {
        state.getLastCartItemIds().clear();
        items.forEach(i -> state.getLastCartItemIds().add(i.getCartItemId()));
        if (items.size() == 1) state.setSelectedCartItemId(items.get(0).getCartItemId());
    }

    private Map<String, Object> cartData(List<CartItem> items) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (CartItem item : items) {
            ProductVariant v = item.getVariant();
            if (v == null || v.getProduct() == null || v.getPrice() == null || item.getQuantity() == null)
                throw input("Giỏ hàng có sản phẩm không còn khả dụng. Bạn kiểm tra lại ở trang giỏ hàng nhé.");
            rows.add(map("cartItemId", item.getCartItemId(), "productId", v.getProduct().getProductId(),
                    "variantId", v.getVariantId(), "productName", v.getProduct().getProductName(),
                    "size", v.getSize(), "color", v.getColor(), "quantity", item.getQuantity(), "price", v.getPrice(),
                    "lineTotal", v.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())), "stock", v.getStock()));
        }
        return map("items", rows, "subtotal", subtotal(items));
    }

    private BigDecimal subtotal(List<CartItem> items) {
        return items.stream().map(i -> i.getVariant().getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String cartSnapshot(List<CartItem> items) {
        return items.stream().map(i -> i.getCartItemId() + ":" + i.getVariant().getVariantId() + ":" + i.getQuantity())
                .collect(Collectors.joining("|"));
    }

    private void prepare(AgentContext state, String action) {
        state.clearConfirmation();
        state.setPendingAction(action);
        state.setConfirmationToken(UUID.randomUUID().toString());
        state.setConfirmationCreatedAt(System.currentTimeMillis());
    }

    private ChatResponse confirmation(String text, AgentContext state, Map<String, Object> metadata) {
        metadata.put("requiresConfirmation", true);
        metadata.put("confirmationToken", state.getConfirmationToken());
        metadata.put("actions", List.of(action("CANCEL_ORDER".equals(state.getPendingAction()) ? "Xác nhận hủy" : "Xác nhận",
                "CANCEL_ORDER".equals(state.getPendingAction()) ? "Xác nhận hủy" : "Xác nhận"), action("Bỏ qua", "Bỏ qua")));
        return response(text, metadata);
    }

    private List<Map<String, Object>> paymentChoices() {
        return List.of(action("COD — trả khi nhận hàng", "COD"), action("Online qua PayOS", "Thanh toán QR"));
    }

    private String paymentMethod(String value) {
        return switch (normalize(value)) {
            case "cash", "cod" -> "CASH";
            case "qr", "payos", "online" -> "QR";
            default -> throw input("Website hỗ trợ COD và PayOS. Bạn chọn một trong hai phương thức này nhé.");
        };
    }

    private boolean requiresUser(String action) {
        return action.startsWith("CART_") || action.startsWith("ORDER_") || action.startsWith("ADDRESS_")
                || action.startsWith("PAYMENT_") || action.startsWith("CHECKOUT_") || "VOUCHER_APPLY".equals(action);
    }
    private boolean isConfirmation(String text) {
        return Set.of("xac nhan", "xac nhan dat hang", "xac nhan dat don", "xac nhan huy", "xac nhan huy don",
                "xac nhan xoa", "xac nhan xoa gio").contains(text);
    }
    private ChatResponse login() {
        return response("Bạn cần đăng nhập để sử dụng giỏ hàng, địa chỉ, thanh toán và đơn hàng.",
                map("requiresLogin", true, "actions", List.of(link("Đăng nhập", "/auth"))));
    }
    private ChatResponse help() {
        return response("Mình là trợ lý mua sắm JODOK. Bạn có thể tìm sản phẩm, chọn màu/size, thêm hoặc sửa giỏ hàng, áp voucher, thanh toán, xem đơn hàng và phối đồ.",
                map("actions", List.of(action("Tìm áo nam", "Áo nam khoảng 300k"), action("Xem giỏ hàng", "Xem giỏ hàng"),
                        action("Đơn của tôi", "Đơn hàng của tôi"))));
    }
    private ChatResponse response(String text) { return new ChatResponse(text, List.of()); }
    private ChatResponse response(String text, Map<String, Object> metadata) { return new ChatResponse(text, List.of(), metadata); }
    private List<ChatProduct> cards(List<ProductTool.ProductCandidate> products) {
        return products.stream().map(p -> new ChatProduct(p.productId(), p.variantId(), p.productName(),
                p.price(), p.size(), p.color(), p.stock(), p.imageUrl(), null)).toList();
    }
    private static Map<String, Object> map(Object... pairs) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) if (pairs[i + 1] != null) result.put((String) pairs[i], pairs[i + 1]);
        return result;
    }
    private static Map<String, Object> action(String label, String message) { return map("label", label, "message", message); }
    private static Map<String, Object> link(String label, String url) { return map("label", label, "url", url); }
    private static Integer first(AgentPlan plan) { return plan.referenceIndexes() == null || plan.referenceIndexes().isEmpty() ? null : plan.referenceIndexes().get(0); }
    private static <T> T at(List<T> items, Integer index) { return index == null || index < 1 || index > items.size() ? null : items.get(index - 1); }
    private static boolean blank(String text) { return text == null || text.isBlank(); }
    private static String normalize(String text) {
        return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D').toLowerCase(Locale.ROOT).replaceAll("[?!.,]+$", "").trim();
    }
    private static String display(String text) { return blank(text) ? "không phân loại" : text; }
    private static String money(BigDecimal amount) { return String.format(Locale.forLanguageTag("vi-VN"), "%,.0fđ", amount); }
    private static CustomerInput input(String text) { return new CustomerInput(text); }
    private static class CustomerInput extends IllegalArgumentException { CustomerInput(String text) { super(text); } }
}
