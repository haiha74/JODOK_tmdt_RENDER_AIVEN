package com.dacs.fashion.ai.tool;

import com.dacs.fashion.entity.Brand;
import com.dacs.fashion.entity.Category;
import com.dacs.fashion.entity.Product;
import com.dacs.fashion.entity.ProductImage;
import com.dacs.fashion.entity.ProductVariant;
import com.dacs.fashion.repository.ProductRepository;
import com.dacs.fashion.repository.ProductVariantRepository;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Product Tool của JODOK.
 *
 * Quy tắc kiến trúc:
 * - KHÔNG đọc raw message của khách.
 * - Groq/JodokAgent sẽ hiểu ngôn ngữ tự nhiên và tạo SearchRequest.
 * - Class này chỉ thực thi constraint có cấu trúc trên dữ liệu thật trong DB.
 * - Chỉ trả dữ liệu public cần thiết cho AI/UI.
 */
@Component
public class ProductTool {

    private static final int DEFAULT_LIMIT = 12;
    private static final int MAX_LIMIT = 30;

    private final ProductRepository productRepository;
    private final ProductVariantRepository variantRepository;

    public ProductTool(
            ProductRepository productRepository,
            ProductVariantRepository variantRepository
    ) {
        this.productRepository = productRepository;
        this.variantRepository = variantRepository;
    }

    public record SearchRequest(
            String productType,
            String audience,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            BigDecimal targetPrice,
            String size,
            String color,
            String brand,
            String occasion,
            String style,
            Boolean stockOnly,
            Integer limit,
            String keyword,
            String category,
            Boolean sale,
            String sort
    ) {
        public SearchRequest(String productType, String audience, BigDecimal minPrice,
                             BigDecimal maxPrice, BigDecimal targetPrice, String size, String color,
                             String brand, String occasion, String style, Boolean stockOnly, Integer limit) {
            this(productType, audience, minPrice, maxPrice, targetPrice, size, color, brand,
                    occasion, style, stockOnly, limit, null, null, null, null);
        }
    }

    public record ProductCandidate(
            Long productId,
            Long variantId,
            String productName,
            String description,
            String category,
            String brand,
            BigDecimal price,
            String size,
            String color,
            Integer stock,
            String imageUrl
    ) {
    }

    public record CatalogInfo(
            Set<String> categories,
            Set<String> brands
    ) {
    }

    /**
     * Search bằng structured arguments.
     * Không nhận message của người dùng.
     */
    public List<ProductCandidate> search(SearchRequest request) {

        SearchRequest safe = request == null
                ? new SearchRequest(
                        null, null,
                        null, null, null,
                        null, null, null,
                        null, null,
                        true, DEFAULT_LIMIT
                )
                : request;

        int limit = normalizeLimit(safe.limit());

        // The current catalog has no sale price or promotion field. Never invent a discount.
        if (Boolean.TRUE.equals(safe.sale())) return List.of();
        if (safe.minPrice() != null && safe.maxPrice() != null
                && safe.minPrice().compareTo(safe.maxPrice()) > 0) return List.of();

        List<ProductCandidate> catalog = loadPublicCatalog();

        List<ProductCandidate> hardFiltered = catalog.stream()
                .filter(item -> Boolean.FALSE.equals(safe.stockOnly()) || item.stock() > 0)
                .filter(item -> safe.minPrice() == null
                        || item.price().compareTo(safe.minPrice()) >= 0)
                .filter(item -> safe.maxPrice() == null
                        || item.price().compareTo(safe.maxPrice()) <= 0)
                .filter(item -> isBlank(safe.size())
                        || sameText(item.size(), safe.size()))
                .filter(item -> isBlank(safe.color())
                        || semanticContains(item.color(), safe.color()))
                .filter(item -> isBlank(safe.brand())
                        || sameText(item.brand(), safe.brand()))
                .filter(item -> isBlank(safe.audience()) || matchesAudience(item, safe.audience()))
                .filter(item -> isBlank(safe.category()) || containsPhrase(item.category(), safe.category()))
                .filter(item -> isBlank(safe.keyword()) || metadataContains(item, safe.keyword()))
                .filter(item -> isBlank(safe.productType())
                        || matchesProductType(item, safe.productType()))
                .toList();

        /*
         * Một product có thể có nhiều variant.
         * Rank variant trước rồi chỉ giữ variant phù hợp nhất của mỗi product
         * để card không bị lặp cùng một sản phẩm.
         */
        List<ProductCandidate> ranked = new ArrayList<>(hardFiltered);

        Comparator<ProductCandidate> ranking = Comparator
                        .comparingInt(
                                (ProductCandidate item) ->
                                        semanticScore(item, safe)
                        )
                        .reversed()
                        .thenComparing(
                                item -> priceDistance(
                                        item.price(),
                                        safe.targetPrice()
                                )
                        )
                        .thenComparing(
                                ProductCandidate::productId,
                                Comparator.nullsLast(Long::compareTo)
                        )
                        .thenComparing(
                                ProductCandidate::variantId,
                                Comparator.nullsLast(Long::compareTo)
                        );
        if (safe.targetPrice() != null) {
            ranking = Comparator.comparing((ProductCandidate item) -> priceDistance(item.price(), safe.targetPrice()))
                    .thenComparing(ranking);
        }
        if ("PRICE_ASC".equalsIgnoreCase(safe.sort())) {
            ranking = Comparator.comparing(ProductCandidate::price).thenComparing(ranking);
        } else if ("PRICE_DESC".equalsIgnoreCase(safe.sort())) {
            ranking = Comparator.comparing(ProductCandidate::price).reversed().thenComparing(ranking);
        }
        ranked.sort(ranking);

        Map<Long, ProductCandidate> oneVariantPerProduct =
                new LinkedHashMap<>();

        for (ProductCandidate item : ranked) {

            if (item.productId() == null) {
                continue;
            }

            oneVariantPerProduct.putIfAbsent(
                    item.productId(),
                    item
            );

            if (oneVariantPerProduct.size() >= limit) {
                break;
            }
        }

        return List.copyOf(oneVariantPerProduct.values());
    }

    /**
     * Dùng cho câu hỏi như:
     * "Shop có những thương hiệu nào?"
     * "Có những danh mục gì?"
     */
    public CatalogInfo getCatalogInfo() {

        Set<String> categories = new LinkedHashSet<>();
        Set<String> brands = new LinkedHashSet<>();

        for (Product product : productRepository.findAll()) {

            if (!isProductActive(product)) {
                continue;
            }

            Category category = product.getCategory();
            Brand brand = product.getBrand();

            if (
                    category != null
                            && !isBlank(category.getCategoryName())
            ) {
                categories.add(
                        category.getCategoryName().trim()
                );
            }

            if (
                    brand != null
                            && !isBlank(brand.getBrandName())
            ) {
                brands.add(
                        brand.getBrandName().trim()
                );
            }
        }

        return new CatalogInfo(
                Set.copyOf(categories),
                Set.copyOf(brands)
        );
    }

    /**
     * Lấy các variant public của một product.
     * Sẽ dùng cho "mẫu 2 còn size L/màu đen không?".
     */
    public List<ProductCandidate> getVariants(Long productId) {

        if (productId == null) {
            return List.of();
        }

        return variantRepository.findByProduct_ProductId(productId).stream()
                .filter(this::isVariantPublic)
                .map(this::toCandidate)
                .filter(Objects::nonNull)
                .sorted(
                        Comparator
                                .comparing(
                                        ProductCandidate::price,
                                        Comparator.nullsLast(
                                                BigDecimal::compareTo
                                        )
                                )
                                .thenComparing(
                                        ProductCandidate::variantId,
                                        Comparator.nullsLast(
                                                Long::compareTo
                                        )
                                )
                )
                .toList();
    }

    /**
     * Lookup chính xác variant trước khi CartTool thao tác.
     */
    public ProductCandidate getVariant(Long variantId) {

        if (variantId == null) {
            return null;
        }

        ProductVariant variant =
                variantRepository.findById(variantId)
                        .orElse(null);

        if (!isVariantPublic(variant)) {
            return null;
        }

        return toCandidate(variant);
    }

    private List<ProductCandidate> loadPublicCatalog() {

        List<ProductCandidate> result = new ArrayList<>();

        /*
         * Dùng variantRepository làm nguồn chính vì giá/size/màu/stock
         * nằm trên ProductVariant trong project JODOK hiện tại.
         */
        for (ProductVariant variant : variantRepository.findAll()) {

            if (!isVariantPublic(variant)) {
                continue;
            }

            ProductCandidate candidate =
                    toCandidate(variant);

            if (candidate != null) {
                result.add(candidate);
            }
        }

        return result;
    }

    private ProductCandidate toCandidate(
            ProductVariant variant
    ) {

        if (variant == null || variant.getProduct() == null) {
            return null;
        }

        Product product = variant.getProduct();

        Category category = product.getCategory();
        Brand brand = product.getBrand();

        BigDecimal price =
                variant.getPrice() != null
                        ? variant.getPrice()
                        : product.getBasePrice();

        if (price == null || price.signum() < 0) {
            return null;
        }

        return new ProductCandidate(
                product.getProductId(),
                variant.getVariantId(),
                safeText(product.getProductName()),
                trimDescription(product.getDescription()),
                categoryPath(category),
                brand == null
                        ? ""
                        : safeText(brand.getBrandName()),
                price,
                safeText(variant.getSize()),
                safeText(variant.getColor()),
                variant.getStock() == null
                        ? 0
                        : Math.max(variant.getStock(), 0),
                findImageUrl(product, variant.getColor())
        );
    }

    /** Prefer the image matching the selected variant color, then the main product image. */
    private String findImageUrl(Product product, String color) {
        if (product == null || product.getImages() == null) return null;
        List<ProductImage> images = product.getImages().stream()
                .filter(Objects::nonNull)
                .filter(img -> img.getImageUrl() != null && !img.getImageUrl().isBlank())
                .toList();
        if (images.isEmpty()) return null;
        if (color != null && !color.isBlank()) {
            for (ProductImage img : images) {
                if (img.getColor() != null && img.getColor().trim().equalsIgnoreCase(color.trim())) {
                    return img.getImageUrl().trim();
                }
            }
        }
        for (ProductImage img : images) {
            if (Boolean.TRUE.equals(img.getIsMain())) return img.getImageUrl().trim();
        }
        return images.get(0).getImageUrl().trim();
    }

    private boolean isVariantPublic(
            ProductVariant variant
    ) {

        if (variant == null || variant.getProduct() == null) {
            return false;
        }

        if (!isProductActive(variant.getProduct())) {
            return false;
        }

        String status = variant.getStatus();

        /*
         * Giữ tương thích dữ liệu cũ:
         * status null/blank vẫn được coi là usable,
         * giống logic CartService hiện tại.
         */
        return status == null
                || status.isBlank()
                || "ACTIVE".equalsIgnoreCase(status);
    }

    private boolean isProductActive(Product product) {

        if (product == null) {
            return false;
        }

        return "ACTIVE".equalsIgnoreCase(
                safeText(product.getStatus())
        );
    }

    /**
     * productType là output có cấu trúc của AI, không phải raw message.
     *
     * Ví dụ:
     * productType="áo"
     * sẽ match tên/category như "Áo thun", "Áo sơ mi",
     * nhưng không match "Tất", "Quần", "Váy".
     */
    private boolean matchesProductType(
            ProductCandidate item,
            String productType
    ) {

        String wanted = canonicalType(productType);

        if (wanted.isBlank()) {
            return true;
        }

        String name = canonicalType(item.productName());
        String category = canonicalType(item.category());

        if (
                containsPhrase(name, wanted)
                        || containsPhrase(category, wanted)
        ) {
            return true;
        }

        String combined =
                " " + name + " " + category + " ";

        for (String token : wanted.split("\\s+")) {

            if (token.length() < 2) {
                continue;
            }

            if (!combined.contains(" " + token + " ")) {
                return false;
            }
        }

        return true;
    }

    private int semanticScore(
            ProductCandidate item,
            SearchRequest request
    ) {

        int score = 0;

        if (
                !isBlank(request.productType())
                        && matchesProductType(
                                item,
                                request.productType()
                        )
        ) {
            score += 50;
        }

        if (
                !isBlank(request.audience())
                        && metadataContains(
                                item,
                                request.audience()
                        )
        ) {
            score += 18;
        }

        if (
                !isBlank(request.occasion())
                        && metadataContains(
                                item,
                                request.occasion()
                        )
        ) {
            score += 12;
        }

        if (
                !isBlank(request.style())
                        && metadataContains(
                                item,
                                request.style()
                        )
        ) {
            score += 10;
        }

        if (
                !isBlank(request.color())
                        && semanticContains(
                                item.color(),
                                request.color()
                        )
        ) {
            score += 10;
        }

        if (
                !isBlank(request.brand())
                        && sameText(
                                item.brand(),
                                request.brand()
                        )
        ) {
            score += 12;
        }

        if (
                !isBlank(request.size())
                        && sameText(
                                item.size(),
                                request.size()
                        )
        ) {
            score += 8;
        }

        if (item.stock() > 0) {
            score += 3;
        }

        return score;
    }

    private boolean metadataContains(
            ProductCandidate item,
            String value
    ) {

        String needle = normalize(value);

        if (needle.isBlank()) {
            return false;
        }

        String haystack = normalize(
                item.productName()
                        + " "
                        + item.description()
                        + " "
                        + item.category()
                        + " "
                        + item.brand()
                        + " "
                        + item.color()
        );

        return containsPhrase(
                haystack,
                needle
        );
    }

    private boolean semanticContains(
            String actual,
            String wanted
    ) {

        String left = normalize(actual);
        String right = normalize(wanted);

        if (right.isBlank()) {
            return true;
        }

        return !left.isBlank() && containsPhrase(canonicalColor(left), canonicalColor(right));
    }

    public boolean supportsSales() { return false; }

    /** Shared by search and variant selection so missing colors never match a request. */
    public boolean matchesColor(String actual, String wanted) {
        return isBlank(wanted) || semanticContains(actual, wanted);
    }

    public boolean matchesSize(String actual, String wanted) {
        return isBlank(wanted) || sameText(actual, wanted);
    }

    private boolean matchesAudience(ProductCandidate item, String audience) {
        String wanted = normalize(audience);
        if (Set.of("male", "men", "man", "boy", "nam").contains(wanted)) wanted = "nam";
        if (Set.of("female", "women", "woman", "girl", "nu").contains(wanted)) wanted = "nu";
        String metadata = normalize(item.productName() + " " + item.category());
        boolean unisex = containsPhrase(metadata, "unisex") || containsPhrase(metadata, "nam va nu")
                || containsPhrase(metadata, "nam nu");
        if ("unisex".equals(wanted)) return unisex;
        if (unisex && Set.of("nam", "nu").contains(wanted)) return true;
        boolean male = containsPhrase(metadata, "nam") || containsPhrase(metadata, "men")
                || containsPhrase(metadata, "male");
        boolean female = containsPhrase(metadata, "nu") || containsPhrase(metadata, "women")
                || containsPhrase(metadata, "female");
        // Prefer the explicit catalog classification. Generic descriptions cannot override it.
        if (male || female) return "nam".equals(wanted) ? male && !female
                : "nu".equals(wanted) ? female && !male : containsPhrase(metadata, wanted);
        String description = normalize(item.description());
        return containsPhrase(description, "danh cho " + wanted)
                || containsPhrase(description, "thoi trang " + wanted);
    }

    private String categoryPath(Category category) {
        List<String> names = new ArrayList<>();
        Set<Category> visited = java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
        while (category != null && visited.add(category) && names.size() < 8) {
            if (!isBlank(category.getCategoryName())) names.add(category.getCategoryName().trim());
            category = category.getParent();
        }
        return String.join(" / ", names);
    }

    private String canonicalType(String value) {
        return normalize(value).replaceAll("\\bt shirts?\\b|\\btshirts?\\b|\\btee\\b", "ao thun")
                .replaceAll("\\bshirts?\\b", "ao so mi")
                .replaceAll("\\bsneakers?\\b|\\bshoes?\\b", "giay")
                .replaceAll("\\bjeans?\\b", "jean");
    }

    private String canonicalColor(String value) {
        return normalize(value).replaceAll("\\bblack\\b", "den").replaceAll("\\bwhite\\b", "trang")
                .replaceAll("\\bred\\b", "do").replaceAll("\\bblue\\b", "xanh duong")
                .replaceAll("\\bgreen\\b", "xanh la").replaceAll("\\bgrey\\b|\\bgray\\b", "xam")
                .replaceAll("\\bbeige\\b", "be").replaceAll("\\bbrown\\b", "nau");
    }

    private boolean sameText(
            String left,
            String right
    ) {
        return normalize(left)
                .equals(normalize(right));
    }

    private boolean containsPhrase(
            String text,
            String phrase
    ) {

        if (text == null || phrase == null) {
            return false;
        }

        String haystack =
                " " + normalize(text) + " ";

        String needle =
                " " + normalize(phrase) + " ";

        return haystack.contains(needle);
    }

    private BigDecimal priceDistance(
            BigDecimal price,
            BigDecimal target
    ) {

        if (price == null || target == null) {
            return BigDecimal.ZERO;
        }

        return price.subtract(target).abs();
    }

    private int normalizeLimit(Integer requested) {

        if (requested == null || requested <= 0) {
            return DEFAULT_LIMIT;
        }

        return Math.min(
                requested,
                MAX_LIMIT
        );
    }

    private String trimDescription(String value) {

        String text = safeText(value);

        if (text.length() <= 160) {
            return text;
        }

        return text.substring(0, 160) + "...";
    }

    private String safeText(String value) {
        return value == null
                ? ""
                : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null
                || value.isBlank();
    }

    private String normalize(String value) {

        if (value == null) {
            return "";
        }

        String normalized =
                Normalizer.normalize(
                        value,
                        Normalizer.Form.NFD
                );

        normalized =
                normalized.replaceAll(
                        "\\p{M}+",
                        ""
                );

        normalized =
                normalized.toLowerCase(Locale.ROOT);

        normalized =
                normalized.replace('đ', 'd');

        normalized =
                normalized.replaceAll(
                        "[^a-z0-9]+",
                        " "
                );

        return normalized.trim()
                .replaceAll("\\s+", " ");
    }
}
