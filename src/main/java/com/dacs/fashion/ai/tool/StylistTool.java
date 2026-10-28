package com.dacs.fashion.ai.tool;

import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.util.List;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import com.dacs.fashion.ai.agent.VietnamesePlanParser;

@Component
public class StylistTool {
    private final ProductTool productTool;
    public StylistTool(ProductTool productTool) { this.productTool = productTool; }

    public List<ProductTool.ProductCandidate> candidates(String audience, BigDecimal totalBudget, String color, String occasion, String style) {
        return candidates(audience, totalBudget, color, occasion, style, null);
    }

    public List<ProductTool.ProductCandidate> candidates(String audience, BigDecimal totalBudget, String color,
                                                         String occasion, String style,
                                                         ProductTool.ProductCandidate anchor) {
        if (anchor != null && (anchor.price() == null || anchor.price().signum() < 0
                || !fits(anchor.price(), totalBudget))) return List.of();
        BigDecimal max = totalBudget == null ? null : totalBudget;
        List<ProductTool.ProductCandidate> candidates = productTool.search(new ProductTool.SearchRequest(
                null, audience, null, max, null, null, color, null,
                occasion, style, true, 30
        ));
        // One item per complementary group; never call six shirts an outfit.
        Map<String, ProductTool.ProductCandidate> groups = new LinkedHashMap<>();
        candidates.stream().sorted(Comparator.comparing(ProductTool.ProductCandidate::price))
                .filter(candidate -> anchor == null || !java.util.Objects.equals(candidate.productId(), anchor.productId()))
                .forEach(candidate -> {
                    String group = group(candidate);
                    if (group != null) groups.putIfAbsent(group, candidate);
                });
        List<ProductTool.ProductCandidate> selected = new ArrayList<>();
        BigDecimal remaining = totalBudget;
        String anchorGroup = anchor == null ? null : group(anchor);
        if (anchor != null) {
            remaining = append(selected, anchor, remaining);
            if (anchorGroup != null) groups.remove(anchorGroup);
        }
        ProductTool.ProductCandidate top = groups.get("TOP");
        ProductTool.ProductCandidate bottom = groups.get("BOTTOM");
        ProductTool.ProductCandidate dress = groups.get("DRESS");
        boolean pairFits = top != null && bottom != null && fits(top.price().add(bottom.price()), remaining);
        if ("TOP".equals(anchorGroup)) {
            if (bottom != null && fits(bottom.price(), remaining)) remaining = append(selected, bottom, remaining);
        } else if ("BOTTOM".equals(anchorGroup)) {
            if (top != null && fits(top.price(), remaining)) remaining = append(selected, top, remaining);
        } else if ("DRESS".equals(anchorGroup)) {
            // A dress is already the main garment; only shoes/accessories can complement it.
        } else if (pairFits) {
            remaining = append(selected, top, remaining);
            remaining = append(selected, bottom, remaining);
        } else if (dress != null && fits(dress.price(), remaining)) {
            remaining = append(selected, dress, remaining);
        } else {
            if (top != null && fits(top.price(), remaining)) remaining = append(selected, top, remaining);
            else if (bottom != null && fits(bottom.price(), remaining)) remaining = append(selected, bottom, remaining);
        }
        for (String group : List.of("SHOES", "ACCESSORY")) {
            ProductTool.ProductCandidate item = groups.get(group);
            if (item != null && fits(item.price(), remaining)) remaining = append(selected, item, remaining);
        }
        return List.copyOf(selected);
    }

    private boolean fits(BigDecimal price, BigDecimal remaining) {
        return remaining == null || price.compareTo(remaining) <= 0;
    }

    private BigDecimal append(List<ProductTool.ProductCandidate> selected, ProductTool.ProductCandidate item, BigDecimal remaining) {
        selected.add(item);
        return remaining == null ? null : remaining.subtract(item.price());
    }

    private String group(ProductTool.ProductCandidate item) {
        String text = " " + VietnamesePlanParser.normalize(item.productName() + " " + item.category()) + " ";
        if (contains(text, "chan vay", "quan", "jeans", "short")) return "BOTTOM";
        if (contains(text, "dam", "vay", "dress", "jumpsuit")) return "DRESS";
        if (contains(text, "ao", "shirt", "hoodie", "polo")) return "TOP";
        if (contains(text, "giay", "dep", "sneaker", "shoe", "sandal")) return "SHOES";
        if (contains(text, "tui", "that lung", "mu", "non", "khan", "tat", "phu kien")) return "ACCESSORY";
        return null;
    }

    private boolean contains(String text, String... phrases) {
        for (String phrase : phrases) if (text.contains(" " + phrase + " ")) return true;
        return false;
    }
}
