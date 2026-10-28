package com.dacs.fashion.ai.tool;

import com.dacs.fashion.entity.Brand;
import com.dacs.fashion.entity.Category;
import com.dacs.fashion.entity.Product;
import com.dacs.fashion.entity.ProductVariant;
import com.dacs.fashion.repository.ProductRepository;
import com.dacs.fashion.repository.ProductVariantRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProductToolTest {
    private final ProductRepository products = mock(ProductRepository.class);
    private final ProductVariantRepository variants = mock(ProductVariantRepository.class);
    private final ProductTool tool = new ProductTool(products, variants);

    private ProductVariant item(long id, String name, String categoryName, String brandName, String color, String size, int price, int stock) {
        Category category = Category.builder().categoryName(categoryName).status("ACTIVE").build();
        Brand brand = new Brand(); brand.setBrandName(brandName);
        Product product = Product.builder().productId(id).productName(name).category(category).brand(brand)
                .basePrice(BigDecimal.valueOf(price)).status("ACTIVE").build();
        return ProductVariant.builder().variantId(id * 10).product(product).color(color).size(size)
                .price(BigDecimal.valueOf(price)).stock(stock).status("ACTIVE").build();
    }

    private ProductTool.SearchRequest request(String type, String audience, String color, String size, String brand, Integer min, Integer max) {
        return new ProductTool.SearchRequest(type, audience, min == null ? null : BigDecimal.valueOf(min),
                max == null ? null : BigDecimal.valueOf(max), null, size, color, brand, null, null, true, 12);
    }

    @Test void regressionNeverReplacesMensShirtWithHeelsAtTheSamePrice() {
        ProductVariant shirt = item(1, "Áo thun nam", "Áo", "Nike", "Đen", "L", 200000, 4);
        ProductVariant heels = item(2, "Giày cao gót mảnh", "Giày nữ", "Nike", "Đen", "42", 200000, 9);
        ProductVariant women = item(3, "Áo thun nữ", "Áo", "Nike", "Đen", "L", 200000, 5);
        when(variants.findAll()).thenReturn(List.of(heels, women, shirt));
        assertEquals(List.of(1L), tool.search(request("áo", "nam", null, null, null, null, null)).stream()
                .map(ProductTool.ProductCandidate::productId).toList());
        when(variants.findAll()).thenReturn(List.of(heels, women));
        assertTrue(tool.search(request("áo", "nam", null, null, null, null, null)).isEmpty());
    }

    @Test void everyExplicitAttributeAndPriceIsHardFilteredOnTheSameVariant() {
        ProductVariant match = item(1, "Áo thun nam", "Áo", "Nike", "Đen", "L", 200000, 4);
        ProductVariant wrongColor = item(2, "Áo thun nam", "Áo", "Nike", "Trắng", "L", 200000, 4);
        ProductVariant wrongSize = item(3, "Áo thun nam", "Áo", "Nike", "Đen", "M", 200000, 4);
        ProductVariant wrongBrand = item(4, "Áo thun nam", "Áo", "Adidas", "Đen", "L", 200000, 4);
        ProductVariant tooCheap = item(5, "Áo thun nam", "Áo", "Nike", "Đen", "L", 99000, 4);
        ProductVariant tooDear = item(6, "Áo thun nam", "Áo", "Nike", "Đen", "L", 300000, 4);
        ProductVariant soldOut = item(7, "Áo thun nam", "Áo", "Nike", "Đen", "L", 200000, 0);
        ProductVariant unknownColor = item(8, "Áo thun nam", "Áo", "Nike", "", "L", 200000, 4);
        when(variants.findAll()).thenReturn(List.of(match, wrongColor, wrongSize, wrongBrand, tooCheap, tooDear, soldOut, unknownColor));
        assertEquals(List.of(1L), tool.search(request("áo thun", "nam", "đen", "l", "nike", 100000, 250000)).stream()
                .map(ProductTool.ProductCandidate::productId).toList());
    }

    @Test void audienceUsesParentCategoryAndUnisexButNeverAnUnknownOrOppositeGender() {
        ProductVariant parent = item(1, "Áo basic", "Áo", "JODOK", "Đen", "L", 200000, 2);
        parent.getProduct().getCategory().setParent(Category.builder().categoryName("Thời trang nam").build());
        ProductVariant unisex = item(2, "Áo unisex", "Áo", "JODOK", "Đen", "L", 200000, 2);
        ProductVariant unknown = item(3, "Áo basic", "Áo", "JODOK", "Đen", "L", 200000, 2);
        ProductVariant women = item(4, "Áo nữ", "Áo", "JODOK", "Đen", "L", 200000, 2);
        women.getProduct().setDescription("Áo dành cho nam cũng có ở gian hàng khác");
        when(variants.findAll()).thenReturn(List.of(parent, unisex, unknown, women));
        assertEquals(List.of(1L, 2L), tool.search(request("áo", "nam", null, null, null, null, null)).stream()
                .map(ProductTool.ProductCandidate::productId).toList());
    }

    @Test void inactiveCatalogAndUnavailablePricesAreExcluded() {
        ProductVariant inactiveProduct = item(1, "Áo nam", "Áo", "Nike", "Đen", "L", 100000, 1);
        inactiveProduct.getProduct().setStatus("INACTIVE");
        ProductVariant inactiveVariant = item(2, "Áo nam", "Áo", "Nike", "Đen", "L", 100000, 1);
        inactiveVariant.setStatus("INACTIVE");
        ProductVariant missingPrice = item(3, "Áo nam", "Áo", "Nike", "Đen", "L", 100000, 1);
        missingPrice.setPrice(null); missingPrice.getProduct().setBasePrice(null);
        ProductVariant basePrice = item(4, "Áo nam", "Áo", "Nike", "Đen", "L", 100000, 1);
        basePrice.setPrice(null);
        when(variants.findAll()).thenReturn(List.of(inactiveProduct, inactiveVariant, missingPrice, basePrice));
        List<ProductTool.ProductCandidate> result = tool.search(request("áo", "nam", null, null, null, null, null));
        assertEquals(1, result.size());
        assertEquals(4L, result.get(0).productId());
        assertEquals(BigDecimal.valueOf(100000), result.get(0).price());
    }

    @Test void sortsAndDeduplicatesByProductWithoutLosingMatchingVariant() {
        ProductVariant cheap = item(1, "Áo nam", "Áo", "Nike", "Đen", "M", 100000, 1);
        ProductVariant anotherSize = item(1, "Áo nam", "Áo", "Nike", "Đen", "L", 110000, 1);
        anotherSize.setVariantId(11L);
        ProductVariant dear = item(2, "Áo nam", "Áo", "Nike", "Đen", "M", 300000, 1);
        when(variants.findAll()).thenReturn(List.of(dear, anotherSize, cheap));
        ProductTool.SearchRequest search = new ProductTool.SearchRequest("áo", "nam", null, null, null, null, null,
                null, null, null, true, 12, null, null, false, "PRICE_ASC");
        List<ProductTool.ProductCandidate> result = tool.search(search);
        assertEquals(2, result.size());
        assertEquals(10L, result.get(0).variantId());
        assertEquals(2L, result.get(1).productId());
    }

    @Test void readsRealVariantsIncludingSoldOutAndDoesNotInventSaleData() {
        ProductVariant soldOut = item(5, "Áo nam", "Áo", "Nike", "Đen", "L", 200000, 0);
        when(variants.findByProduct_ProductId(5L)).thenReturn(List.of(soldOut));
        when(variants.findById(50L)).thenReturn(Optional.of(soldOut));
        assertEquals(0, tool.getVariants(5L).get(0).stock());
        assertEquals(50L, tool.getVariant(50L).variantId());
        verify(variants, never()).findAll();
        assertFalse(tool.supportsSales());
        assertTrue(tool.search(new ProductTool.SearchRequest("áo", null, null, null, null, null, null,
                null, null, null, true, 12, null, null, true, null)).isEmpty());
    }

    @Test void colorsAreAccentInsensitiveButMissingMetadataDoesNotMatch() {
        assertTrue(tool.matchesColor("Đen", "den"));
        assertTrue(tool.matchesColor("Black", "đen"));
        assertFalse(tool.matchesColor("", "đen"));
        assertFalse(tool.matchesColor(null, "đen"));
        assertFalse(tool.matchesColor("Đen", "đỏ"));
        assertFalse(tool.matchesSize("XL", "L"));
        assertTrue(tool.matchesSize(" l ", "L"));
    }

    @Test void targetBudgetRanksBeforeSoftMetadataWithoutRelaxingHardType() {
        when(variants.findAll()).thenReturn(List.of(
                item(1, "Áo nam", "Áo", "Nike", "Đen", "L", 400000, 1),
                item(2, "Áo unisex", "Áo", "Nike", "Đen", "L", 200000, 1),
                item(3, "Giày nam", "Giày", "Nike", "Đen", "42", 200000, 1)));
        List<ProductTool.ProductCandidate> results = tool.search(new ProductTool.SearchRequest("áo", "nam", null,
                null, BigDecimal.valueOf(200000), null, null, null, null, null, true, 1));
        assertEquals(List.of(2L), results.stream().map(ProductTool.ProductCandidate::productId).toList());
    }

    @Test void stylistNeverExceedsTotalOutfitBudget() {
        when(variants.findAll()).thenReturn(List.of(
                item(1, "Áo nam", "Áo", "Nike", "Đen", "L", 400000, 1),
                item(2, "Quần nam", "Quần", "Nike", "Đen", "L", 350000, 1),
                item(3, "Giày nam", "Giày", "Nike", "Đen", "42", 500000, 1)));
        List<ProductTool.ProductCandidate> outfit = new StylistTool(tool).candidates("nam", BigDecimal.valueOf(1000000), null, null, null);
        assertEquals(2, outfit.size());
        assertTrue(outfit.stream().map(ProductTool.ProductCandidate::price).reduce(BigDecimal.ZERO, BigDecimal::add)
                .compareTo(BigDecimal.valueOf(1000000)) <= 0);
    }

    @Test void stylistChoosesComplementaryPiecesInsteadOfRepeatedShirts() {
        when(variants.findAll()).thenReturn(List.of(
                item(1, "Áo thun nam", "Áo", "Nike", "Đen", "L", 150000, 1),
                item(2, "Áo polo nam", "Áo", "Nike", "Đen", "L", 200000, 1),
                item(3, "Áo sơ mi nam", "Áo", "Nike", "Đen", "L", 300000, 1),
                item(4, "Quần nam", "Quần", "Nike", "Đen", "L", 250000, 1),
                item(5, "Giày nam", "Giày", "Nike", "Đen", "42", 400000, 1),
                item(6, "Mũ nam", "Phụ kiện", "Nike", "Đen", "L", 100000, 1)));
        List<ProductTool.ProductCandidate> outfit = new StylistTool(tool).candidates("nam", BigDecimal.valueOf(1000000), null, null, null);
        assertEquals(List.of(1L, 4L, 5L, 6L), outfit.stream().map(ProductTool.ProductCandidate::productId).toList());
    }

    @Test void stylistUsesDressAsAlternativeToTopAndBottomAndAllowsTruthfulPartialSelection() {
        when(variants.findAll()).thenReturn(List.of(
                item(1, "Áo nữ", "Áo", "Nike", "Đen", "L", 300000, 1),
                item(2, "Quần nữ", "Quần", "Nike", "Đen", "L", 300000, 1),
                item(3, "Đầm nữ", "Đầm", "Nike", "Đen", "L", 400000, 1)));
        List<ProductTool.ProductCandidate> dress = new StylistTool(tool).candidates("nữ", BigDecimal.valueOf(500000), null, null, null);
        assertEquals(List.of(3L), dress.stream().map(ProductTool.ProductCandidate::productId).toList());
        when(variants.findAll()).thenReturn(List.of(item(1, "Áo nam", "Áo", "Nike", "Đen", "L", 200000, 1)));
        assertEquals(1, new StylistTool(tool).candidates("nam", BigDecimal.valueOf(500000), null, null, null).size());
    }

    @Test void stylistKeepsSelectedAnchorAndCountsItsPriceWithinTotalBudget() {
        ProductVariant selectedShirt = item(1, "Áo polo nam đã chọn", "Áo", "Nike", "Đen", "L", 350000, 1);
        when(variants.findById(10L)).thenReturn(Optional.of(selectedShirt));
        when(variants.findAll()).thenReturn(List.of(
                selectedShirt,
                item(2, "Áo thun nam rẻ hơn", "Áo", "Nike", "Đen", "L", 100000, 1),
                item(3, "Quần nam", "Quần", "Nike", "Đen", "L", 250000, 1),
                item(4, "Giày nam", "Giày", "Nike", "Đen", "42", 300000, 1),
                item(5, "Mũ nam", "Phụ kiện", "Nike", "Đen", "L", 100000, 1)));
        ProductTool.ProductCandidate anchor = tool.getVariant(10L);
        List<ProductTool.ProductCandidate> outfit = new StylistTool(tool).candidates("nam", BigDecimal.valueOf(800000),
                null, null, null, anchor);
        assertEquals(List.of(1L, 3L, 5L), outfit.stream().map(ProductTool.ProductCandidate::productId).toList());
        assertEquals(anchor, outfit.get(0));
        assertEquals(BigDecimal.valueOf(700000), outfit.stream().map(ProductTool.ProductCandidate::price).reduce(BigDecimal.ZERO, BigDecimal::add));
        assertTrue(new StylistTool(tool).candidates("nam", BigDecimal.valueOf(300000), null, null, null, anchor).isEmpty());
    }

    @Test void stylistComplementsDressAnchorWithoutAddingAnotherDressTopOrBottom() {
        ProductVariant dress = item(1, "Đầm nữ đã chọn", "Đầm", "Nike", "Đen", "L", 400000, 1);
        when(variants.findById(10L)).thenReturn(Optional.of(dress));
        when(variants.findAll()).thenReturn(List.of(dress,
                item(2, "Đầm nữ khác", "Đầm", "Nike", "Đen", "L", 200000, 1),
                item(3, "Áo nữ", "Áo", "Nike", "Đen", "L", 100000, 1),
                item(4, "Quần nữ", "Quần", "Nike", "Đen", "L", 100000, 1),
                item(5, "Giày nữ", "Giày", "Nike", "Đen", "38", 200000, 1)));
        List<ProductTool.ProductCandidate> outfit = new StylistTool(tool).candidates("nữ", BigDecimal.valueOf(1000000),
                null, null, null, tool.getVariant(10L));
        assertEquals(List.of(1L, 5L), outfit.stream().map(ProductTool.ProductCandidate::productId).toList());
    }
}
