package com.dacs.fashion.ai.agent;

import com.dacs.fashion.ai.tool.ProductTool;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Deterministic extraction for shopping commands; ambiguous language is left to the planner. */
public final class VietnamesePlanParser {
    private static final Pattern MONEY = Pattern.compile("(?<![a-z0-9])([0-9]+(?:[.,][0-9]+)*)\\s*(trieu|tr|nghin|ngan|k|vnd|dong|d)?(?![a-z])");
    private static final Pattern REFERENCE = Pattern.compile("(?:mau|cai|san pham)(?:\\s+(?:thu|so))?\\s*(\\d+)");
    private static final Pattern SIZE = Pattern.compile("\\bsize\\s*(xxxl|xxl|xl|xs|s|m|l|[0-9]{2,3})\\b|^(xxxl|xxl|xl|xs|s|m|l)$");

    public AgentPlan parse(String raw, AgentContext context, ProductTool.CatalogInfo catalog) {
        String text = normalize(raw);
        if (text.isBlank()) return null;
        AgentPlan.AgentPlanBuilder plan = AgentPlan.builder();
        List<Integer> refs = references(text);
        if (!refs.isEmpty()) plan.referenceIndexes(refs);
        extractParameters(text, raw, catalog, plan);
        String action = action(text, context);
        if (action == null && plan.build().brand() != null) action = "PRODUCT_SEARCH";
        if (action == null && plan.build().voucherCode() != null && has(text, "dung duoc", "hop le", "kiem tra")) action = "VOUCHER_CHECK";
        if (action == null) return null;
        plan.action(action);
        AgentPlan extracted = plan.build();
        if ("PRODUCT_SEARCH".equals(action)) {
            AgentPlan previous = context.getLastSearchRequest();
            // A new explicit product type starts a search; short modifier turns refine it.
            if (previous != null && extracted.productType() == null && !has(text, "tim moi", "tim lai", "san pham khac")) {
                extracted = mergeSearch(previous, extracted);
            }
            if (has(text, "re hon")) {
                BigDecimal ceiling = previous == null ? null : previous.targetPrice() != null
                        ? previous.targetPrice() : previous.maxPrice();
                extracted = extracted.toBuilder().sort("PRICE_ASC").targetPrice(null).minPrice(null)
                        .maxPrice(ceiling == null ? null : ceiling.multiply(new BigDecimal("0.8"))).build();
            }
        }
        if ("OUTFIT".equals(action)) {
            BigDecimal budget = extracted.maxPrice() != null ? extracted.maxPrice() : extracted.targetPrice();
            extracted = extracted.toBuilder().totalBudget(budget).build();
        }
        if ("VOUCHER_CHECK".equals(action) && extracted.voucherCode() == null) {
            extracted = extracted.toBuilder().action("VOUCHER_LIST").build();
        }
        return extracted;
    }

    private String action(String text, AgentContext context) {
        if (text.matches("(?:toi )?(?:xac nhan(?: huy)?|dong y(?: dat hang)?|huy xac nhan|ok)[.!]?")) return "UNKNOWN";
        if (has(text, "xoa het gio", "xoa toan bo gio", "lam trong gio", "clear cart")) return "CART_CLEAR";
        if (has(text, "huy don")) return "ORDER_CANCEL";
        if (has(text, "thuong hieu nao", "thuong hieu gi", "hang nao", "cac thuong hieu", "danh sach thuong hieu", "liet ke thuong hieu")
                || text.equals("thuong hieu")) return "PRODUCT_BRANDS";
        if (has(text, "phuong thuc thanh toan", "cach thanh toan")) return "PAYMENT_METHODS";
        if (has(text, "chon dia chi") || text.matches(".*\\bdia chi(?: so| thu)? \\d+.*")) return "ADDRESS_SELECT";
        if (has(text, "dia chi", "giao ve dau", "giao ve dia chi")) return "ADDRESS_LIST";
        if (has(text, "ap ma", "ap voucher", "dung ma", "dung voucher", "chon ma tot nhat", "ma tot nhat")) return "VOUCHER_APPLY";
        if (has(text, "voucher", "ma giam gia", "khuyen mai", "ma nao dung", "ma nao ap")) {
            return has(text, "dung duoc", "hop le", "kiem tra") && !has(text, "ma nao") ? "VOUCHER_CHECK" : "VOUCHER_LIST";
        }
        if (has(text, "thanh toan roi", "da thanh toan", "thanh toan thanh cong")) return "ORDER_STATUS";
        if (has(text, "thanh toan", "payos", "qr") && Pattern.compile("\\bdon(?: hang)?(?: #| so | )#?\\d+\\b").matcher(text).find()) return "PAYMENT_CREATE";
        if (has(text, "thanh toan", "checkout", "mua luon", "dat hang", "cod", "payos", "qr", "online", "chuyen khoan")) return "CHECKOUT_SUMMARY";
        if (Pattern.compile("\\bdon(?: hang)?(?: #| so | )#?\\d+\\b").matcher(text).find()) return "ORDER_DETAIL";
        if (has(text, "don gan nhat", "don moi nhat")) return "ORDER_LATEST";
        if (has(text, "don hang", "don cua toi", "don gan nhat", "don dang", "don nao", "da giao", "don #", "don so", "don nay", "don dau")) {
            if (has(text, "don nao", "cac don", "don dang van chuyen", "don cho xac nhan")) return "ORDER_LIST";
            if (has(text, "o dau", "trang thai", "da giao", "van chuyen", "cho xac nhan")) return "ORDER_STATUS";
            if (has(text, "gan nhat", "don #", "don so", "don nay")) return "ORDER_DETAIL";
            return "ORDER_LIST";
        }
        if (has(text, "xem gio", "gio hang co gi", "gio cua toi", "gio hang")) {
            if (has(text, "xoa", "bo", "lay ra")) return "CART_REMOVE";
            if (has(text, "them", "cho vao", "bo vao")) return "CART_ADD";
            if (has(text, "doi", "tang", "giam", "cap nhat")) return "CART_UPDATE";
            return "CART_VIEW";
        }
        if (has(text, "xoa san pham", "xoa ao", "xoa quan", "xoa cai", "xoa mau", "bo san pham")) return "CART_REMOVE";
        if (has(text, "doi so luong", "doi thanh", "tang len", "giam con", "so luong thanh")
                || has(text, "doi") && has(text, "thanh") && !references(text).isEmpty()) return "CART_UPDATE";
        if (has(text, "them", "cho toi") && (has(text, "cai", "size", "mau", "san pham", "ao", "quan", "giay", "vao gio") || context.getSelectedProductId() != null)) return "CART_ADD";
        if (has(text, "so sanh")) return "COMPARE";
        if (has(text, "outfit", "phoi do", "tu van", "do di hoc", "do di sinh nhat", "hop voi")) return "OUTFIT";
        if (!references(text).isEmpty() && !has(text, "tim", "mua", "co size", "con size", "con mau", "co mau", "con hang")) return "PRODUCT_DETAIL";
        if (has(text, "gia bao nhieu", "giam bao nhieu", "chi tiet", "ao nay", "cai nay", "mau nay")) return "PRODUCT_DETAIL";
        if (has(text, "con hang", "con bao nhieu", "ton kho", "con size", "co size", "con mau", "co mau", "mau gi", "size gi")) return "VARIANT_CHECK";
        if (!hasProductType(text) && !has(text, "tim", "tim moi")) {
            if (context.getPendingCartAdd() && (SIZE.matcher(text).find() || isColor(text))) return "CART_ADD";
            if (context.getSelectedProductId() != null && (SIZE.matcher(text).find() || isColor(text))) return "VARIANT_CHECK";
        }
        if (has(text, "xin chao", "chao", "hello", "hi") && text.split(" ").length <= 4) return "GREETING";
        if (has(text, "huong dan", "giup toi", "lam duoc gi", "ho tro", "help")) return "HELP";
        if (hasProductType(text) || has(text, "tim", "do nam", "do nu", "do adidas", "do nike", "san pham", "re hon", "re nhat", "sale", "giam gia")
                || isColor(text) || SIZE.matcher(text).find() || MONEY.matcher(text).find()) return "PRODUCT_SEARCH";
        return null;
    }

    private void extractParameters(String text, String raw, ProductTool.CatalogInfo catalog, AgentPlan.AgentPlanBuilder plan) {
        String requested = text.split("\\b(?:hop voi|ket hop voi|voi)\\b", 2)[0];
        String requestedType = null;
        int typePosition = Integer.MAX_VALUE;
        for (String type : List.of("ao thun", "ao phong", "ao so mi", "ao khoac", "ao len", "ao polo", "ao hoodie", "quan jean", "quan jeans", "quan tay", "quan short", "chan vay", "giay cao got", "giay the thao", "ao", "quan", "giay", "vay", "dam", "tui", "tat", "mu")) {
            Matcher match = Pattern.compile("\\b" + Pattern.quote(type) + "\\b").matcher(requested);
            if (match.find() && match.start() < typePosition) {
                requestedType = type.equals("ao phong") ? "ao thun" : type;
                typePosition = match.start();
            }
        }
        plan.productType(requestedType);
        if (has(text, "unisex")) plan.audience("unisex");
        else if (has(text, "nam")) plan.audience("nam");
        else if (has(text, "nu")) plan.audience("nữ");
        Matcher size = SIZE.matcher(text);
        if (size.find()) plan.size((size.group(1) == null ? size.group(2) : size.group(1)).toUpperCase(Locale.ROOT));
        for (String color : colors()) if (has(text, color) && isColorMention(color, text, raw)) { plan.color(color); break; }
        if (catalog != null) for (String brand : catalog.brands()) {
            if (!normalize(brand).isBlank() && has(text, normalize(brand))) { plan.brand(brand); break; }
        }
        if (has(text, "nike")) plan.brand("Nike");
        if (has(text, "adidas")) plan.brand("Adidas");
        Matcher explicitBrand = Pattern.compile("\\b(?:thuong hieu|hang|brand)\\s+(.+)").matcher(text);
        if (explicitBrand.find()) {
            String namedBrand = explicitBrand.group(1).split(
                    "\\s+(?:mau|size|nam|nu|duoi|tren|khoang|tam|gia|con|co|khong|voi|tu|den|re|dat)\\b", 2)[0]
                    .replaceAll("[.,]+$", "").trim();
            if (!namedBrand.isBlank() && !namedBrand.matches("(?:nao|gi|cua|do|nay)(?:\\s+.*)?")) plan.brand(namedBrand);
        }
        if (has(text, "re nhat", "re hon", "gia tang", "gia thap")) plan.sort("PRICE_ASC");
        if (has(text, "dat nhat", "gia giam", "gia cao")) plan.sort("PRICE_DESC");
        if (has(text, "sale", "dang giam gia", "dang sale")) plan.sale(true);
        if (has(text, "di choi")) plan.occasion("đi chơi");
        if (has(text, "di hoc")) plan.occasion("đi học");
        if (has(text, "sinh nhat")) plan.occasion("sinh nhật");
        if (has(text, "cod", "khi nhan hang", "tien mat")) plan.paymentMethod("COD");
        else if (has(text, "payos", "qr", "online", "truc tuyen", "chuyen khoan")) plan.paymentMethod("QR");
        Matcher address = Pattern.compile("dia chi(?: so| thu)? (\\d+)").matcher(text);
        if (address.find()) plan.addressIndex(parseInteger(address.group(1)));
        Matcher order = Pattern.compile("don(?: hang)?(?: #| so | )#?(\\d+)").matcher(text);
        if (order.find()) plan.orderId(parseLong(order.group(1)));
        if (has(text, "van chuyen", "dang giao")) plan.orderStatus("SHIPPING");
        else if (has(text, "cho xac nhan")) plan.orderStatus("PENDING");
        else if (has(text, "da giao")) plan.orderStatus("COMPLETED");
        Matcher quantity = Pattern.compile("(?:them|cho toi|thanh|tang len|giam con|so luong)\\s+(-?[0-9]+(?:[.,][0-9]+)*)|(?<![0-9])-?([0-9]+)\\s+cai\\b").matcher(text);
        if (quantity.find()) {
            String rawQuantity = quantity.group(1) == null ? quantity.group().replaceFirst("\\s+cai$", "") : quantity.group(1);
            Integer value = parseInteger(rawQuantity);
            plan.quantity(value == null ? 0 : value);
        }
        Matcher voucher = Pattern.compile("(?iu)(?:voucher|mã|ma)\\s+([\\p{L}\\p{N}_-]+)").matcher(raw);
        if (voucher.find()) {
            String code = voucher.group(1);
            if (!List.of("nao", "giam", "tot", "hieu", "dung", "ap", "cho", "cua").contains(normalize(code))) plan.voucherCode(code.toUpperCase(Locale.ROOT));
        }
        parsePrices(text, plan);
    }

    private void parsePrices(String text, AgentPlan.AgentPlanBuilder plan) {
        List<BigDecimal> amounts = new ArrayList<>();
        List<Integer> starts = new ArrayList<>();
        Matcher matcher = MONEY.matcher(text);
        while (matcher.find()) {
            String unit = matcher.group(2);
            String prefix = text.substring(Math.max(0, matcher.start() - 12), matcher.start());
            if (unit == null && (!prefix.matches(".*(?:gia|duoi|tren|tu|den|khoang|tam|toi da|toi thieu)\\s*$")
                    || prefix.matches(".*(?:size|mau|cai|dia chi|don)\\s*$"))) continue;
            BigDecimal amount = money(matcher.group(1), unit);
            if (amount == null) continue;
            amounts.add(amount); starts.add(matcher.start());
        }
        if (amounts.isEmpty()) return;
        if (amounts.size() >= 2 && (has(text, "tu") && has(text, "den") || text.contains("-") || text.contains("–"))) {
            plan.minPrice(amounts.get(0)).maxPrice(amounts.get(1)); return;
        }
        BigDecimal amount = amounts.get(0);
        String before = text.substring(0, starts.get(0));
        if (has(before, "duoi", "khong qua", "toi da", "khong hon", "nho hon")) plan.maxPrice(amount);
        else if (has(before, "tren", "tu", "toi thieu", "it nhat", "lon hon")) plan.minPrice(amount);
        else plan.targetPrice(amount);
    }

    private BigDecimal money(String digits, String unit) {
        try {
            String normalized = digits;
            boolean thousands = digits.matches("\\d{1,3}(?:[.,]\\d{3})+");
            normalized = thousands ? digits.replace(".", "").replace(",", "") : digits.replace(',', '.');
            BigDecimal multiplier = unit == null ? BigDecimal.ONE : switch (unit) {
                case "k", "nghin", "ngan" -> new BigDecimal("1000");
                case "tr", "trieu" -> new BigDecimal("1000000");
                default -> BigDecimal.ONE;
            };
            BigDecimal amount = new BigDecimal(normalized).multiply(multiplier);
            return amount.signum() < 0 || amount.compareTo(new BigDecimal("1000000000000")) > 0 ? null : amount;
        } catch (NumberFormatException exception) { return null; }
    }

    private AgentPlan mergeSearch(AgentPlan old, AgentPlan current) {
        boolean newPrice = current.minPrice() != null || current.maxPrice() != null || current.targetPrice() != null;
        return current.toBuilder().productType(current.productType() == null ? old.productType() : current.productType())
                .audience(current.audience() == null ? old.audience() : current.audience())
                .brand(current.brand() == null ? old.brand() : current.brand())
                .size(current.size() == null ? old.size() : current.size())
                .color(current.color() == null ? old.color() : current.color())
                .minPrice(newPrice ? current.minPrice() : old.minPrice()).maxPrice(newPrice ? current.maxPrice() : old.maxPrice())
                .targetPrice(newPrice ? current.targetPrice() : old.targetPrice())
                .occasion(current.occasion() == null ? old.occasion() : current.occasion())
                .style(current.style() == null ? old.style() : current.style())
                .keyword(current.keyword() == null ? old.keyword() : current.keyword())
                .category(current.category() == null ? old.category() : current.category())
                .stock(current.stock() == null ? old.stock() : current.stock())
                .limit(current.limit() == null ? old.limit() : current.limit())
                .sort(current.sort() == null ? old.sort() : current.sort()).sale(current.sale() == null ? old.sale() : current.sale()).build();
    }

    private List<Integer> references(String text) {
        List<Integer> values = new ArrayList<>();
        Matcher matcher = REFERENCE.matcher(text);
        while (matcher.find()) { Integer value = parseInteger(matcher.group(1)); if (value != null) values.add(value); }
        if (has(text, "so sanh") && values.size() == 1) {
            Matcher other = Pattern.compile("\\bva\\s+(\\d+)\\b").matcher(text);
            if (other.find()) { Integer value = parseInteger(other.group(1)); if (value != null) values.add(value); }
        }
        return List.copyOf(values);
    }

    private boolean hasProductType(String text) { return has(text, "ao", "quan", "giay", "vay", "dam", "tui", "tat", "mu"); }
    private boolean isColor(String text) { return colors().stream().anyMatch(color -> has(text, color)
            && (!List.of("do", "tim").contains(color) || text.equals(color) || has(text, "mau " + color))); }
    private boolean isColorMention(String color, String text, String raw) {
        if ("do".equals(color)) return raw.toLowerCase(Locale.ROOT).contains("đỏ") || text.equals("do") || has(text, "mau do");
        if ("tim".equals(color)) return raw.toLowerCase(Locale.ROOT).contains("tím") || text.equals("tim") || has(text, "mau tim");
        return true;
    }
    private List<String> colors() { return List.of("xanh duong", "xanh la", "xanh navy", "hong", "den", "trang", "xam", "ghi", "nau", "vang", "tim", "cam", "be", "do", "xanh"); }
    private boolean has(String text, String... phrases) {
        String words = " " + text.replaceAll("(?<![0-9])[.,]|[.,](?![0-9])", " ").trim() + " ";
        for (String phrase : phrases) if (words.contains(" " + phrase + " ")) return true;
        return false;
    }
    private Integer parseInteger(String value) { try { return Integer.valueOf(value); } catch (NumberFormatException ex) { return null; } }
    private Long parseLong(String value) { try { return Long.valueOf(value); } catch (NumberFormatException ex) { return null; } }
    public static String normalize(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT).replace('đ', 'd').replaceAll("[^a-z0-9.,#–-]+", " ").trim().replaceAll("\\s+", " ");
    }
}
