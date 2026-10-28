package com.dacs.fashion.ai.agent;

import com.dacs.fashion.ai.tool.ProductTool;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class VietnamesePlanParserTest {
    private final VietnamesePlanParser parser = new VietnamesePlanParser();
    private final AgentContext context = new AgentContext();
    private final ProductTool.CatalogInfo catalog = new ProductTool.CatalogInfo(Set.of("Áo nam", "Đồ nữ"), Set.of("Nike", "Adidas", "JODOK"));

    private AgentPlan parse(String message) { return parser.parse(message, context, catalog); }

    @Test void regressionKeepsMensShirtAndSoftBudget() {
        AgentPlan plan = parse("Áo nam khoảng 200k");
        assertEquals("PRODUCT_SEARCH", plan.action());
        assertEquals("ao", plan.productType());
        assertEquals("nam", plan.audience());
        assertEquals(0, new BigDecimal("200000").compareTo(plan.targetPrice()));
        assertNull(plan.minPrice());
        assertNull(plan.maxPrice());
        assertNull(plan.color());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Áo 100k", "Áo 100 nghìn", "Áo 100 ngàn", "Áo tầm 100000 đồng"})
    void normalizesHundredThousand(String message) {
        assertEquals(0, new BigDecimal("100000").compareTo(parse(message).targetPrice()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"Tìm đồ khoảng 1 triệu", "Tìm đồ khoảng 1tr", "Tìm đồ khoảng 1.000.000 đồng", "Tìm đồ khoảng 1000k"})
    void normalizesMillion(String message) {
        AgentPlan plan = parse(message);
        assertEquals(0, new BigDecimal("1000000").compareTo(plan.targetPrice()));
        assertNull(plan.color(), "Tìm and đồ are not the colors tím and đỏ");
    }

    @Test void parsesExplicitBoundsAndDecimals() {
        assertEquals(0, new BigDecimal("300000").compareTo(parse("Áo thun nam dưới 300k").maxPrice()));
        assertEquals(0, new BigDecimal("500000").compareTo(parse("Áo trên 500k").minPrice()));
        AgentPlan range = parse("Quần nữ từ 200k đến 500k");
        assertEquals(0, new BigDecimal("200000").compareTo(range.minPrice()));
        assertEquals(0, new BigDecimal("500000").compareTo(range.maxPrice()));
        assertNull(range.targetPrice());
        assertEquals(0, new BigDecimal("1500000").compareTo(parse("Tìm đồ khoảng 1,5 triệu").targetPrice()));
        assertEquals(0, new BigDecimal("500000").compareTo(parse("Áo 200k - 500k").maxPrice()));
    }

    @Test void parsesClothingAttributesWithoutConfusingQuantitySizeOrColor() {
        AgentPlan women = parse("Đồ nữ màu đen");
        assertEquals("nữ", women.audience());
        assertEquals("den", women.color());
        assertNull(women.productType());
        AgentPlan shoe = parse("Giày nam size 42");
        assertEquals("giay", shoe.productType());
        assertEquals("42", shoe.size());
        assertNull(shoe.targetPrice());
        AgentPlan shirt = parse("Áo đen size L");
        assertEquals("L", shirt.size());
        assertEquals("den", shirt.color());
        assertEquals("Nike", parse("Áo Nike").brand());
        assertEquals("Adidas", parse("Đồ Adidas").brand());
        assertEquals("PRICE_ASC", parse("Áo nào rẻ nhất?").sort());
        assertTrue(parse("Áo nào đang sale?").sale());
        assertEquals("do", parse("Tìm áo đỏ").color());
        assertEquals("tim", parse("Tìm áo tím").color());
    }

    @Test void preservesStructuredSearchThenChangesOnlyRequestedFilter() {
        context.setLastSearchRequest(parse("Áo nam khoảng 300k"));
        AgentPlan black = parse("Màu đen");
        assertEquals("ao", black.productType());
        assertEquals("nam", black.audience());
        assertEquals("den", black.color());
        assertEquals(0, new BigDecimal("300000").compareTo(black.targetPrice()));
        context.setLastSearchRequest(black);
        AgentPlan cheaper = parse("Rẻ hơn");
        assertEquals("den", cheaper.color());
        assertEquals("ao", cheaper.productType());
        assertEquals("PRICE_ASC", cheaper.sort());
        assertEquals(0, new BigDecimal("240000").compareTo(cheaper.maxPrice()));
        assertNull(cheaper.targetPrice());
        AgentPlan fresh = parse("Giày nam size 42");
        assertEquals("giay", fresh.productType());
        assertNull(fresh.color());
    }

    @Test void resolvesOrdinalThenVariantAndPendingAdd() {
        assertEquals(List.of(2), parse("Chọn cái thứ 2").referenceIndexes());
        assertEquals("PRODUCT_DETAIL", parse("Chọn mẫu 2").action());
        context.setSelectedProductId(5L);
        assertEquals("VARIANT_CHECK", parse("Size L").action());
        assertEquals("VARIANT_CHECK", parse("Còn màu đen không?").action());
        context.setPendingCartAdd(true);
        assertEquals("CART_ADD", parse("Size L màu đen").action());
        assertEquals("PRODUCT_SEARCH", parse("Giày nam size 42").action());
        assertEquals(2, parse("Thêm 2 cái").quantity());
        assertEquals(List.of(2), parse("Đổi mẫu 2 thành 3").referenceIndexes());
        assertEquals(3, parse("Đổi mẫu 2 thành 3").quantity());
        assertEquals("CART_UPDATE", parse("Đổi mẫu 2 thành 3").action());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Thêm -2 cái", "Thêm 0 cái", "Thêm 999999999999999999999 cái", "Thêm 2.5 cái"})
    void invalidQuantitiesRemainInvalidInsteadOfDefaultingToOne(String message) {
        AgentPlan plan = parse(message);
        assertEquals("CART_ADD", plan.action());
        assertNotNull(plan.quantity());
        assertTrue(plan.quantity() <= 0);
    }

    @ParameterizedTest
    @CsvSource(value = {
            "Shop có thương hiệu nào?|PRODUCT_BRANDS",
            "Xem giỏ hàng|CART_VIEW",
            "Thêm cái này vào giỏ|CART_ADD",
            "Thêm size L màu đen|CART_ADD",
            "Đổi thành 3|CART_UPDATE",
            "Xóa sản phẩm này|CART_REMOVE",
            "Xóa hết giỏ|CART_CLEAR",
            "Có voucher nào dùng được không?|VOUCHER_LIST",
            "Voucher ABC có dùng được không?|VOUCHER_CHECK",
            "Mã ABC có dùng được không?|VOUCHER_CHECK",
            "Áp voucher ABC|VOUCHER_APPLY",
            "Áp mã tốt nhất|VOUCHER_APPLY",
            "Thanh toán|CHECKOUT_SUMMARY",
            "Đặt hàng|CHECKOUT_SUMMARY",
            "Thanh toán COD|CHECKOUT_SUMMARY",
            "Thanh toán QR|CHECKOUT_SUMMARY",
            "Thanh toán đơn #123|PAYMENT_CREATE",
            "Tôi thanh toán rồi|ORDER_STATUS",
            "Đổi địa chỉ|ADDRESS_LIST",
            "Chọn địa chỉ 2|ADDRESS_SELECT",
            "Đơn hàng của tôi|ORDER_LIST",
            "Đơn gần nhất|ORDER_LATEST",
            "Đơn đang ở đâu?|ORDER_STATUS",
            "Đơn nào đang vận chuyển?|ORDER_LIST",
            "Đơn nào chờ xác nhận?|ORDER_LIST",
            "Đơn #123|ORDER_DETAIL",
            "Hủy đơn|ORDER_CANCEL",
            "Xác nhận|UNKNOWN",
            "Xác nhận hủy|UNKNOWN",
            "Tư vấn outfit nam|OUTFIT"
    }, delimiter = '|')
    void routesRequiredVietnameseCommands(String message, String expected) {
        AgentPlan plan = parse(message);
        assertNotNull(plan, message);
        assertEquals(expected, plan.action());
    }

    @Test void extractsCheckoutValuesAndDoesNotInventIds() {
        assertEquals("COD", parse("Thanh toán COD").paymentMethod());
        assertEquals("QR", parse("Thanh toán QR").paymentMethod());
        assertEquals(2, parse("Chọn địa chỉ 2").addressIndex());
        assertEquals(123L, parse("Thanh toán đơn #123").orderId());
        assertEquals("ABC", parse("Áp voucher ABC").voucherCode());
        assertNull(parse("Áp mã tốt nhất").voucherCode());
        assertEquals("PENDING", parse("Đơn nào chờ xác nhận?").orderStatus());
        assertEquals("SHIPPING", parse("Đơn nào đang vận chuyển?").orderStatus());
        assertNull(parse("Cái thứ 2").productId());
        assertEquals(0, new BigDecimal("1000000").compareTo(parse("Outfit dưới 1 triệu").totalBudget()));
    }

    @Test void outfitSeparatesRequestedGarmentFromReferenceGarment() {
        assertEquals("quan", parse("Tìm quần hợp với áo này").productType());
        assertEquals("OUTFIT", parse("Tìm quần hợp với áo này").action());
        assertNull(parse("Phối đồ với áo này").productType());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Áo thương hiệu Puma", "Áo hãng Puma", "Đồ thương hiệu Puma", "Áo hãng Puma màu đen size L"})
    void explicitBrandIsAHardConstraintEvenWhenTheCatalogDoesNotHaveIt(String message) {
        AgentPlan plan = parse(message);
        assertEquals("PRODUCT_SEARCH", plan.action());
        assertEquals("puma", plan.brand());
    }

    @Test void refinementPreservesAllPreviousStructuredConstraints() {
        context.setLastSearchRequest(AgentPlan.builder().action("PRODUCT_SEARCH").productType("áo")
                .audience("nam").brand("Puma").keyword("cotton").category("Áo thun")
                .stock(true).limit(5).minPrice(BigDecimal.valueOf(100000)).maxPrice(BigDecimal.valueOf(300000)).build());
        AgentPlan plan = parse("Màu đen");
        assertEquals("Puma", plan.brand());
        assertEquals("cotton", plan.keyword());
        assertEquals("Áo thun", plan.category());
        assertEquals(true, plan.stock());
        assertEquals(5, plan.limit());
        assertEquals(BigDecimal.valueOf(100000), plan.minPrice());
        assertEquals(BigDecimal.valueOf(300000), plan.maxPrice());
    }
}
