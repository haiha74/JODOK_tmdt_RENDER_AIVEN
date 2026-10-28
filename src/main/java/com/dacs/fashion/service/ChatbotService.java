package com.dacs.fashion.service;


import java.util.stream.Collectors;
import com.dacs.fashion.controller.ChatbotController.ChatProduct;

import com.dacs.fashion.controller.ChatbotController.ChatResponse;

import com.dacs.fashion.entity.Brand;

import com.dacs.fashion.entity.Category;

import com.dacs.fashion.entity.Product;

import com.dacs.fashion.entity.ProductVariant;
import com.dacs.fashion.entity.Cart;
import com.dacs.fashion.entity.CartItem;
import com.dacs.fashion.dto.CartItemDTO;

import com.dacs.fashion.repository.ProductRepository;

import com.dacs.fashion.repository.ProductVariantRepository;

import com.fasterxml.jackson.databind.JsonNode;

import com.fasterxml.jackson.databind.ObjectMapper;


import org.springframework.beans.factory.annotation.Value;

import org.springframework.http.MediaType;

import org.springframework.stereotype.Service;

import org.springframework.web.client.RestClient;

import org.springframework.web.client.RestClientResponseException;



import java.math.BigDecimal;

import java.text.Normalizer;

import java.time.Duration;

import java.util.*;

import java.util.concurrent.ConcurrentHashMap;

import java.util.regex.Matcher;

import java.util.regex.Pattern;



@Service

public class ChatbotService {



    private final ProductRepository productRepository;

    private final ProductVariantRepository variantRepository;

    private final ObjectMapper objectMapper;
    private final CartService cartService;

    /*
     * V9.0.1: constructor viết tường minh để tránh class lỗi do incremental
     * compilation/Lombok constructor generation trong VS Code.
     */
    public ChatbotService(
            ProductRepository productRepository,
            ProductVariantRepository variantRepository,
            ObjectMapper objectMapper,
            CartService cartService
    ) {
        this.productRepository = productRepository;
        this.variantRepository = variantRepository;
        this.objectMapper = objectMapper;
        this.cartService = cartService;
    }



    @Value("${GROQ_API_KEY:}")

    private String apiKey;



    @Value("${groq.model:openai/gpt-oss-20b}")

    private String model;



    private static final int MAX_CARDS = 8;

    private static final int MAX_AI_ITEMS = 8;
    private static final int MAX_AI_CATALOG_PRODUCTS = 60;
    private static final int MAX_AI_DESCRIPTION_CHARS = 120;
    private static final int MAX_AI_HISTORY_TURNS = 6;

    private static final long CONTEXT_TTL_MS = 30 * 60 * 1000L;



    private volatile long groqPauseUntil = 0L;



    private final Map<String, ChatContext> contexts = new ConcurrentHashMap<>();



    private final RestClient restClient = RestClient.builder()

            .requestFactory(requestFactory())

            .build();



    private static org.springframework.http.client.SimpleClientHttpRequestFactory requestFactory() {

        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();

        factory.setConnectTimeout(Duration.ofSeconds(5));

        factory.setReadTimeout(Duration.ofSeconds(15));

        return factory;

    }



    private record PublicItem(

            Long productId,

            Long variantId,

            String name,

            String description,

            String category,

            String brand,

            BigDecimal price,

            String size,

            String color,

            int stock

    ) {}



    private record Catalog(

            List<PublicItem> items,

            Set<String> categories,

            Set<String> brands

    ) {}



    private record SearchRequest(

            BigDecimal minPrice,

            BigDecimal maxPrice,

            String size,

            String color,

            String audience,

            boolean stockOnly,

            String productType,

            String brand,

            String occasion,

            String sort,

            boolean exactPrice

    ) {}



    private static class ChatContext {

        SearchRequest lastRequest;

        final List<Long> lastProductIds = new ArrayList<>();

        Long focusedProductId;

        final List<Long> lastOutfitProductIds = new ArrayList<>();

        final List<String> recentTurns = new ArrayList<>();

        String pendingAudience;
        String pendingOccasion;
        BigDecimal pendingBudget;
        String pendingColor;

        long updatedAt = System.currentTimeMillis();

    }



    public ChatResponse reply(String message) {

        return reply(message, "anonymous");

    }



    public ChatResponse reply(String message, String conversationId) {
        return reply(message, conversationId, null);
    }

    /*
     * V9: userId chỉ được truyền từ ChatbotController sau khi đọc Spring Security
     * Authentication. AI không bao giờ được quyền tự chọn userId.
     */
    public ChatResponse reply(String message, String conversationId, Long authenticatedUserId) {

        if (message == null || message.isBlank()) {
            return new ChatResponse(
                    "Bạn cứ nói tự nhiên nhu cầu của mình nhé.",
                    List.of()
            );
        }

        cleanupContexts();

        ChatContext context = contexts.computeIfAbsent(conversationId, k -> new ChatContext());
        context.updatedAt = System.currentTimeMillis();

        Catalog catalog = loadPublicCatalog();

        if (catalog.items().isEmpty()) {
            return new ChatResponse(
                    "Hiện shop chưa có sản phẩm đang mở bán để mình tư vấn.",
                    List.of()
            );
        }

        /*
         * V6 - AI ONLY FOR INTENT UNDERSTANDING
         *
         * Không parseLocally().
         * Không contains/keyword để đoán nam, nữ, giá, màu, dịp...
         * Không Java fallback để tự suy luận nhu cầu khách.
         *
         * Groq đọc câu hiện tại + lịch sử + catalog công khai.
         * Java chỉ:
         *   - nạp dữ liệu thật từ DB;
         *   - kiểm tra productId Groq chọn có tồn tại;
         *   - kiểm tra sản phẩm/variant còn ACTIVE và còn hàng;
         *   - trả card bằng dữ liệu DB thật.
         */
        if (!groqAvailable()) {
            return new ChatResponse(
                    "Trợ lý AI đang tạm bị giới hạn lượt gọi. Mình sẽ không tự lọc bằng từ khóa để tránh tư vấn sai; bạn thử lại sau một chút nhé.",
                    List.of()
            );
        }

        try {
            ChatResponse response = answerNaturallyWithGroq(message, catalog, context, authenticatedUserId);

            if (response == null) {
                return new ChatResponse(
                        "Mình chưa xử lý được yêu cầu này một cách chắc chắn. Bạn thử diễn đạt lại giúp mình nhé.",
                        List.of()
                );
            }

            rememberTurn(context, "User: " + message);
            rememberTurn(context, "Assistant: " + response.reply());

            System.out.println("[CHATBOT][GROQ][AI_ONLY] success");
            return response;

        } catch (RestClientResponseException ex) {
            handleGroqHttpError(ex);
            System.err.println("[CHATBOT][GROQ][AI_ONLY] Groq HTTP error: " + ex.getStatusCode());

            return new ChatResponse(
                    "Trợ lý AI đang tạm bận nên mình chưa thể tư vấn chính xác lúc này. Bạn thử lại sau một chút nhé.",
                    List.of()
            );

        } catch (Exception ex) {
            System.err.println("[CHATBOT][GROQ][AI_ONLY] "
                    + ex.getClass().getSimpleName() + ": " + ex.getMessage());

            return new ChatResponse(
                    "Mình gặp lỗi khi phân tích yêu cầu nên chưa muốn đưa ra sản phẩm sai. Bạn thử lại giúp mình nhé.",
                    List.of()
            );
        }
    }



    /*
     * V9.0.2 - CART TOOL + LAMBDA FINAL FIX
     *
     * Lượt 1: Groq chỉ hiểu ý định và tạo SearchPlan có cấu trúc.
     * Java Product Tool dùng SearchPlan để truy vấn/lọc dữ liệu công khai thật.
     * Lượt 2: Groq chỉ nhìn tập ứng viên nhỏ và chọn variant / phối outfit.
     *
     * Không gửi toàn bộ catalog cho Groq.
     * Không dùng parseLocally()/detectColor()/detectOccasion() trong luồng V8.
     */
    private ChatResponse answerNaturallyWithGroq(
            String message,
            Catalog catalog,
            ChatContext context,
            Long authenticatedUserId
    ) throws Exception {

        String history = context.recentTurns.isEmpty()
                ? "(chưa có hội thoại trước)"
                : String.join("\n", context.recentTurns);

        String previousProducts = context.lastProductIds.isEmpty()
                ? "(chưa có)"
                : context.lastProductIds.toString();

        AiSearchPlan plan = planWithGroq(message, history, previousProducts, catalog);

        if (plan == null) {
            return null;
        }

        String action = upper(plan.action(), "SEARCH");

        if ("ASK_CLARIFICATION".equals(action)) {
            String reply = blankToDefault(
                    plan.reply(),
                    "Bạn nói thêm một chút về nhu cầu để mình chọn chính xác hơn nhé."
            );
            return new ChatResponse(reply, List.of());
        }

        if ("CHAT".equals(action)) {
            String reply = blankToDefault(
                    plan.reply(),
                    "Bạn cứ nói tự nhiên nhu cầu mua sắm, mình sẽ hỗ trợ dựa trên sản phẩm hiện có của JODOK."
            );
            return new ChatResponse(reply, List.of());
        }

        if ("VARIANT_CHECK".equals(action)) {
            return answerRememberedVariantCheck(message, plan, catalog, context, history);
        }

        if ("COMPARE".equals(action)) {
            return answerRememberedComparison(message, plan, catalog, context, history);
        }

        if (Set.of("CART_ADD", "CART_VIEW", "CART_UPDATE", "CART_REMOVE", "CART_CLEAR").contains(action)) {
            return executeCartTool(message, plan, catalog, context, authenticatedUserId, history);
        }

        List<PublicItem> candidates = "OUTFIT".equalsIgnoreCase(plan.mode())
                ? runOutfitCandidateTool(plan, catalog.items())
                : runProductTool(plan, catalog.items());

        if (candidates.isEmpty()) {
            String reply = blankToDefault(
                    plan.reply(),
                    "Mình chưa tìm thấy sản phẩm còn hàng đủ phù hợp với yêu cầu này."
            );
            return new ChatResponse(reply, List.of());
        }

        AiSelection selection = selectCandidatesWithGroq(
                message,
                history,
                plan,
                candidates
        );

        if (selection == null) {
            return new ChatResponse(
                    "Mình đã tìm được dữ liệu sản phẩm nhưng chưa thể chọn phương án đủ chắc chắn. Bạn thử lại giúp mình nhé.",
                    List.of()
            );
        }

        List<PublicItem> verified = verifyGroqSelectedItems(
                selection.selectedItems(),
                candidates
        );

        String reply = sanitizeCustomerReply(blankToDefault(
                selection.reply(),
                verified.isEmpty()
                        ? "Mình chưa tìm thấy lựa chọn đủ phù hợp trong các sản phẩm đang còn hàng."
                        : "Mình tìm được một số lựa chọn phù hợp từ sản phẩm hiện có của JODOK."
        ));

        if (!verified.isEmpty()) {
            context.lastProductIds.clear();
            verified.forEach(item -> context.lastProductIds.add(item.productId()));
            context.focusedProductId = null;
        }

        context.updatedAt = System.currentTimeMillis();

        System.out.println(
                "[CHATBOT][V8.2.1][PRODUCT_TOOL] mode=" + upper(plan.mode(), "SEARCH")
                        + ", candidates=" + candidates.size()
                        + ", selected=" + verified.size()
        );

        return new ChatResponse(reply, toChatProducts(verified));
    }

    private record AiSearchPlan(
            String action,
            String mode,
            String reply,
            String semanticQuery,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            BigDecimal totalBudget,
            String size,
            String color,
            String audience,
            String productType,
            String brand,
            String occasion,
            String style,
            Integer candidateLimit,
            List<Integer> referenceIndexes,
            Integer quantity
    ) {}

    private record AiSelection(
            String reply,
            List<SelectedAiItem> selectedItems
    ) {}

    private AiSearchPlan planWithGroq(
            String message,
            String history,
            String previousProducts,
            Catalog catalog
    ) throws Exception {

        String publicTaxonomy = objectMapper.writeValueAsString(Map.of(
                "categories", catalog.categories().stream().limit(80).toList(),
                "brands", catalog.brands().stream().limit(80).toList()
        ));

        String prompt = """
                Bạn là bộ điều phối AI của JODOK. Nhiệm vụ của bạn CHỈ là hiểu ý định
                mua sắm tự nhiên của khách và tạo kế hoạch cho Product Tool của Java.
                Không được tự chọn productId/variantId ở bước này.

                PHÂN LOẠI:
                - SEARCH: khách muốn tìm/xem một hay nhiều sản phẩm theo loại, giá, màu,
                  size, giới tính, thương hiệu hoặc mô tả.
                - OUTFIT: khách muốn mặc gì/phối đồ/set đồ cho một dịp hoặc phong cách.
                - VARIANT_CHECK: khách hỏi tiếp một mẫu vừa hiển thị còn size/màu/hàng/giá nào.
                - COMPARE: khách muốn so sánh 2-3 mẫu vừa hiển thị.
                - CART_ADD: thêm sản phẩm/biến thể vào giỏ.
                - CART_VIEW: xem/tóm tắt giỏ hàng.
                - CART_UPDATE: đổi số lượng một món trong giỏ.
                - CART_REMOVE: xóa một món khỏi giỏ.
                - CART_CLEAR: xóa toàn bộ giỏ.
                - CHAT: chào hỏi, hỏi danh mục/thương hiệu hoặc câu không cần tìm sản phẩm.
                - ASK_CLARIFICATION: chỉ khi thiếu thông tin thực sự bắt buộc.

                QUY TẮC RẤT QUAN TRỌNG:
                - Luôn đọc CÂU HIỆN TẠI trước lịch sử.
                - Thông tin đã có trong câu hiện tại TUYỆT ĐỐI không được hỏi lại.
                  Ví dụ "Tôi là nam, đi sinh nhật, 500k, thích màu tối" đã có audience=nam,
                  occasion=sinh nhật, totalBudget=500000 và color/preference=màu tối.
                - "Áo nam khoảng 200k" là SEARCH, không hỏi khách mặc dịp nào.
                - Khi khách nêu loại sản phẩm + một mức giá mà KHÔNG có từ chỉ giới hạn
                  như "dưới", "không quá", "tối đa", hãy hiểu là giá XẤP XỈ mức đó.
                  Ví dụ "áo 100k", "áo tầm 100k", "áo khoảng 100k":
                  productType="áo", minPrice=80000, maxPrice=120000.
                - "áo dưới 100k", "áo không quá 100k": maxPrice=100000, minPrice=null.
                - "Có áo polo dưới 250k không?" là SEARCH.
                - "Tôi là nam, cuối tuần đi sinh nhật, 500k, thích màu tối" là OUTFIT,
                  không hỏi lại nam/nữ.
                - Với OUTFIT, totalBudget là ngân sách cho CẢ BỘ.
                - Nếu câu hiện tại nêu đối tượng/dịp mới thì nó ghi đè ngữ cảnh cũ mâu thuẫn.
                - Câu follow-up ngắn như "màu tối", "tầm 500k", "đi chơi", "mẫu khác"
                  có thể kế thừa nhu cầu ngay trước đó.
                - "mẫu 1 còn size L không?", "mẫu 2 có màu đen không?" => VARIANT_CHECK.
                - "so sánh mẫu 1 và mẫu 2", "mẫu nào rẻ hơn?" => COMPARE.
                - "thêm mẫu 1 size L màu đen vào giỏ" => CART_ADD.
                - "xem giỏ hàng", "giỏ của tôi có gì" => CART_VIEW.
                - "đổi mẫu này thành 2 cái" => CART_UPDATE với quantity=2.
                - "xóa mẫu này khỏi giỏ" => CART_REMOVE.
                - "xóa hết giỏ hàng" => CART_CLEAR.
                - quantity mặc định 1 cho CART_ADD nếu khách không nói số lượng.
                - Với thao tác giỏ hàng, AI CHỈ hiểu ý định. Java mới được kiểm tra đăng nhập,
                  variant, tồn kho, quyền sở hữu và gọi CartService.
                - referenceIndexes dùng số thứ tự mẫu khách nhắc tới, bắt đầu từ 1.
                - Nếu khách nói "mẫu này"/"mẫu đó" và chỉ có một mẫu đang được tập trung,
                  có thể dùng referenceIndexes=[1] khi ngữ cảnh đủ rõ.
                - Không tự tạo referenceIndexes vượt quá danh sách PRODUCT VỪA HIỂN THỊ.
                - Hiểu theo NGỮ NGHĨA, không dựa vào danh sách keyword cố định.
                - Không bịa brand/category không có trong taxonomy shop.
                - minPrice/maxPrice là giới hạn cho từng món SEARCH.
                - totalBudget chủ yếu dùng cho OUTFIT.
                - semanticQuery là mô tả ngắn, đầy đủ về thứ khách cần để Product Tool
                  xếp hạng ứng viên; không viết câu trả lời dài vào đây.

                CHAT ĐẶC BIỆT:
                - Nếu khách hỏi shop có thương hiệu/danh mục nào, trả action=CHAT và dùng
                  TAXONOMY CÔNG KHAI để trả lời; không bịa.

                Trả DUY NHẤT JSON:
                {
                  "action":"SEARCH|OUTFIT|VARIANT_CHECK|COMPARE|CART_ADD|CART_VIEW|CART_UPDATE|CART_REMOVE|CART_CLEAR|CHAT|ASK_CLARIFICATION",
                  "mode":"SEARCH|OUTFIT|CHAT",
                  "reply":"",
                  "semanticQuery":"...",
                  "minPrice":null,
                  "maxPrice":null,
                  "totalBudget":null,
                  "size":null,
                  "color":null,
                  "audience":null,
                  "productType":null,
                  "brand":null,
                  "occasion":null,
                  "style":null,
                  "candidateLimit":12,
                  "referenceIndexes":[],
                  "quantity":null
                }

                LỊCH SỬ:
                %s

                PRODUCT VỪA HIỂN THỊ THEO THỨ TỰ (mẫu 1, mẫu 2,...):
                %s

                TAXONOMY JODOK CÔNG KHAI:
                %s

                CÂU HIỆN TẠI:
                %s
                """.formatted(history, previousProducts, publicTaxonomy, message);

        JsonNode node = callGroqJson(prompt);
        if (node == null || !node.isObject()) return null;

        return new AiSearchPlan(
                cleanNullable(node.path("action").asText(null)),
                cleanNullable(node.path("mode").asText(null)),
                cleanNullable(node.path("reply").asText(null)),
                cleanNullable(node.path("semanticQuery").asText(null)),
                decimalOrNull(node.get("minPrice")),
                decimalOrNull(node.get("maxPrice")),
                decimalOrNull(node.get("totalBudget")),
                cleanNullable(node.path("size").asText(null)),
                cleanNullable(node.path("color").asText(null)),
                cleanNullable(node.path("audience").asText(null)),
                cleanNullable(node.path("productType").asText(null)),
                cleanNullable(node.path("brand").asText(null)),
                cleanNullable(node.path("occasion").asText(null)),
                cleanNullable(node.path("style").asText(null)),
                node.path("candidateLimit").canConvertToInt()
                        ? Math.max(5, Math.min(20, node.path("candidateLimit").asInt(12)))
                        : 12,
                readReferenceIndexes(node.path("referenceIndexes")),
                node.path("quantity").canConvertToInt()
                        ? Math.max(1, Math.min(99, node.path("quantity").asInt(1)))
                        : null
        );
    }

    /*
     * Product Tool:
     * - Chỉ dùng các trường có cấu trúc do AI planner trả về.
     * - Java không đọc/diễn giải câu tiếng Việt của khách bằng keyword.
     * - Hard filters: tồn kho, giá, size, brand.
     * - Các thuộc tính semantic như audience/type/color/occasion/style được xếp hạng
     *   trên metadata DB, không loại cứng để tránh mất kết quả khi dữ liệu chưa chuẩn.
     */

    private List<Integer> readReferenceIndexes(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<Integer> result = new ArrayList<>();
        for (JsonNode n : node) {
            if (!n.canConvertToInt()) continue;
            int value = n.asInt();
            if (value >= 1 && value <= MAX_CARDS && !result.contains(value)) {
                result.add(value);
            }
        }
        return result;
    }

    private List<Long> resolveRememberedProductIds(
            AiSearchPlan plan,
            ChatContext context,
            int defaultCount
    ) {
        if (context.lastProductIds.isEmpty()) return List.of();

        List<Long> result = new ArrayList<>();
        List<Integer> indexes = plan.referenceIndexes() == null
                ? List.of()
                : plan.referenceIndexes();

        for (Integer oneBased : indexes) {
            if (oneBased == null) continue;
            int index = oneBased - 1;
            if (index >= 0 && index < context.lastProductIds.size()) {
                Long id = context.lastProductIds.get(index);
                if (!result.contains(id)) result.add(id);
            }
        }

        if (result.isEmpty() && defaultCount > 0) {
            context.lastProductIds.stream()
                    .limit(defaultCount)
                    .forEach(result::add);
        }

        return result;
    }

    private ChatResponse answerRememberedVariantCheck(
            String message,
            AiSearchPlan plan,
            Catalog catalog,
            ChatContext context,
            String history
    ) throws Exception {

        List<Long> productIds = resolveRememberedProductIds(plan, context, 1);

        if (productIds.isEmpty()) {
            return new ChatResponse(
                    "Mình chưa có mẫu nào vừa hiển thị để kiểm tra. Bạn tìm sản phẩm trước rồi hỏi mình size hoặc màu nhé.",
                    List.of()
            );
        }

        Long productId = productIds.get(0);

        List<PublicItem> variants = catalog.items().stream()
                .filter(i -> Objects.equals(i.productId(), productId))
                .sorted(Comparator
                        .comparing((PublicItem i) -> i.stock() <= 0)
                        .thenComparing(PublicItem::price))
                .toList();

        if (variants.isEmpty()) {
            return new ChatResponse(
                    "Mẫu bạn hỏi hiện không còn trong danh mục đang mở bán.",
                    List.of()
            );
        }

        String variantJson = objectMapper.writeValueAsString(
                variants.stream().map(i -> Map.of(
                        "productId", i.productId(),
                        "variantId", i.variantId(),
                        "name", safe(i.name()),
                        "price", i.price(),
                        "size", safe(i.size()),
                        "color", safe(i.color()),
                        "stock", i.stock()
                )).toList()
        );

        String prompt = """
                Bạn là JODOK AI. Khách đang hỏi tiếp về MỘT SẢN PHẨM ĐÃ HIỂN THỊ.
                Hãy kiểm tra chính xác các variant DB bên dưới.

                QUY TẮC:
                - Hiểu câu khách theo ngữ nghĩa.
                - Không bịa size, màu, giá hay tồn kho.
                - stock > 0 nghĩa là còn hàng; stock = 0 nghĩa là hết hàng.
                - Nếu khách hỏi size/màu cụ thể, chỉ kết luận từ variant thật.
                - Nếu có variant phù hợp và còn hàng, chọn đúng variant đó để hiện card.
                - Nếu variant tồn tại nhưng hết hàng, nói rõ hết hàng và có thể gợi ý variant
                  gần nhất còn hàng trong cùng sản phẩm.
                - Nếu không có size/màu đó trong dữ liệu, nói rõ shop chưa có biến thể đó.
                - selectedItems tối đa 2, chỉ dùng ID có trong VARIANTS.
                - Không được viết productId/variantId hoặc ID kỹ thuật vào reply.

                Trả DUY NHẤT JSON:
                {
                  "reply":"...",
                  "selectedItems":[{"productId":1,"variantId":10}]
                }

                LỊCH SỬ:
                %s

                CÂU KHÁCH:
                %s

                VARIANTS DB:
                %s
                """.formatted(history, message, variantJson);

        JsonNode node = callGroqJson(prompt);
        if (node == null || !node.isObject()) return null;

        List<SelectedAiItem> requested = readSelectedItems(node.path("selectedItems"), 2);
        List<PublicItem> verified = verifyGroqSelectedItems(requested, variants);

        context.focusedProductId = productId;
        context.updatedAt = System.currentTimeMillis();

        String reply = sanitizeCustomerReply(blankToDefault(
                cleanNullable(node.path("reply").asText(null)),
                "Mình đã kiểm tra các biến thể hiện có của mẫu này."
        ));

        return new ChatResponse(reply, toChatProducts(verified));
    }

    private ChatResponse answerRememberedComparison(
            String message,
            AiSearchPlan plan,
            Catalog catalog,
            ChatContext context,
            String history
    ) throws Exception {

        List<Long> productIds = resolveRememberedProductIds(plan, context, 2);

        if (productIds.size() < 2) {
            return new ChatResponse(
                    "Bạn cần có ít nhất 2 mẫu vừa hiển thị để mình so sánh. Ví dụ: “so sánh mẫu 1 và mẫu 2”.",
                    List.of()
            );
        }

        productIds = productIds.stream().distinct().limit(3).toList();

        List<Map<String, Object>> summaries = new ArrayList<>();
        List<PublicItem> cards = new ArrayList<>();

        for (Long productId : productIds) {
            List<PublicItem> variants = catalog.items().stream()
                    .filter(i -> Objects.equals(i.productId(), productId))
                    .toList();
            if (variants.isEmpty()) continue;

            PublicItem representative = variants.stream()
                    .filter(i -> i.stock() > 0)
                    .min(Comparator.comparing(PublicItem::price))
                    .orElse(variants.get(0));

            cards.add(representative);

            BigDecimal minPrice = variants.stream()
                    .map(PublicItem::price)
                    .min(BigDecimal::compareTo)
                    .orElse(representative.price());

            BigDecimal maxPrice = variants.stream()
                    .map(PublicItem::price)
                    .max(BigDecimal::compareTo)
                    .orElse(representative.price());

            Set<String> sizes = variants.stream()
                    .filter(i -> i.stock() > 0)
                    .map(PublicItem::size)
                    .filter(Objects::nonNull)
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toCollection(LinkedHashSet::new));

            Set<String> colors = variants.stream()
                    .filter(i -> i.stock() > 0)
                    .map(PublicItem::color)
                    .filter(Objects::nonNull)
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toCollection(LinkedHashSet::new));

            int totalStock = variants.stream()
                    .mapToInt(PublicItem::stock)
                    .sum();

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("productId", representative.productId());
            row.put("name", representative.name());
            row.put("category", representative.category());
            row.put("brand", representative.brand());
            row.put("description", shortenForAi(representative.description(), 180));
            row.put("minPrice", minPrice);
            row.put("maxPrice", maxPrice);
            row.put("sizesInStock", sizes);
            row.put("colorsInStock", colors);
            row.put("totalStock", totalStock);
            summaries.add(row);
        }

        if (summaries.size() < 2) {
            return new ChatResponse(
                    "Mình chưa lấy đủ dữ liệu của các mẫu để so sánh chính xác.",
                    List.of()
            );
        }

        String prompt = """
                Bạn là JODOK AI. Hãy so sánh các sản phẩm DB thật bên dưới theo đúng
                điều khách đang quan tâm.

                QUY TẮC:
                - Chỉ dùng dữ liệu được cung cấp.
                - Có thể so sánh giá, size còn hàng, màu còn hàng, tồn kho, category,
                  brand và description nếu có căn cứ.
                - Không bịa chất liệu/chất lượng/công dụng.
                - Nếu khách hỏi "mẫu nào hợp hơn" nhưng dữ liệu không đủ để kết luận,
                  hãy nói rõ tiêu chí nào xác định được và tiêu chí nào chưa đủ dữ liệu.
                - Nêu kết luận ngắn gọn, dễ chọn.
                - Không được viết productId/variantId hoặc ID kỹ thuật vào reply.
                - Tối đa khoảng 150 từ.

                Trả DUY NHẤT JSON:
                {"reply":"..."}

                LỊCH SỬ:
                %s

                CÂU KHÁCH:
                %s

                SẢN PHẨM SO SÁNH:
                %s
                """.formatted(
                        history,
                        message,
                        objectMapper.writeValueAsString(summaries)
                );

        JsonNode node = callGroqJson(prompt);
        if (node == null || !node.isObject()) return null;

        context.lastProductIds.clear();
        cards.forEach(i -> context.lastProductIds.add(i.productId()));
        context.focusedProductId = null;
        context.updatedAt = System.currentTimeMillis();

        String reply = sanitizeCustomerReply(blankToDefault(
                cleanNullable(node.path("reply").asText(null)),
                "Mình đã đối chiếu các mẫu theo giá và biến thể đang còn hàng."
        ));

        return new ChatResponse(reply, toChatProducts(cards));
    }

    private List<SelectedAiItem> readSelectedItems(JsonNode node, int limit) {
        if (node == null || !node.isArray()) return List.of();

        List<SelectedAiItem> result = new ArrayList<>();
        for (JsonNode item : node) {
            JsonNode productId = item.get("productId");
            JsonNode variantId = item.get("variantId");

            if (productId != null && productId.canConvertToLong()
                    && variantId != null && variantId.canConvertToLong()) {
                result.add(new SelectedAiItem(productId.asLong(), variantId.asLong()));
            }

            if (result.size() >= limit) break;
        }
        return result;
    }


    /*
     * =========================================================
     * V9 CART TOOL
     * Port kiến trúc shopping-agent public: AI lập action có cấu trúc,
     * Java thực thi tool thật. Không cho model ghi DB trực tiếp.
     * =========================================================
     */
    private ChatResponse executeCartTool(
            String message,
            AiSearchPlan plan,
            Catalog catalog,
            ChatContext context,
            Long userId,
            String history
    ) throws Exception {

        if (userId == null) {
            return new ChatResponse(
                    "Bạn cần đăng nhập để mình có thể xem hoặc thay đổi giỏ hàng nhé.",
                    List.of()
            );
        }

        String action = upper(plan.action(), "");

        if ("CART_VIEW".equals(action)) {
            return cartView(userId, catalog, context);
        }

        if ("CART_CLEAR".equals(action)) {
            cartService.clearCart(userId);
            clearProductContext(context);
            return new ChatResponse("Mình đã xóa toàn bộ sản phẩm trong giỏ hàng của bạn.", List.of());
        }

        if ("CART_ADD".equals(action)) {
            return cartAdd(plan, catalog, context, userId);
        }

        if ("CART_UPDATE".equals(action) || "CART_REMOVE".equals(action)) {
            return cartUpdateOrRemove(message, plan, catalog, context, userId, action);
        }

        return new ChatResponse("Mình chưa xác định được thao tác giỏ hàng cần thực hiện.", List.of());
    }

    private ChatResponse cartAdd(
            AiSearchPlan plan,
            Catalog catalog,
            ChatContext context,
            Long userId
    ) {
        List<Long> remembered = resolveRememberedProductIds(plan, context, 1);

        if (remembered.isEmpty()) {
            return new ChatResponse(
                    "Bạn hãy chọn một mẫu mình vừa gợi ý, ví dụ “thêm mẫu 1 size L vào giỏ”.",
                    List.of()
            );
        }

        Long productId = remembered.get(0);

        List<PublicItem> variants = catalog.items().stream()
                .filter(i -> Objects.equals(i.productId(), productId))
                .filter(i -> i.stock() > 0)
                .filter(i -> plan.size() == null || normalize(i.size()).equals(normalize(plan.size())))
                .filter(i -> plan.color() == null || normalize(i.color()).equals(normalize(plan.color())))
                .toList();

        if (variants.isEmpty()) {
            return new ChatResponse(
                    "Mẫu này chưa có biến thể còn hàng đúng size/màu bạn yêu cầu.",
                    List.of()
            );
        }

        /*
         * Nếu khách chưa chỉ rõ đủ biến thể và còn nhiều lựa chọn khác nhau,
         * không tự đoán variant để tránh thêm nhầm hàng.
         */
        Set<String> variantKeys = variants.stream()
                .map(i -> normalize(i.size()) + "|" + normalize(i.color()))
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (variantKeys.size() > 1 && (plan.size() == null || plan.color() == null)) {
            String available = variants.stream()
                    .limit(8)
                    .map(i -> "size " + safe(i.size()) + " - màu " + safe(i.color()))
                    .distinct()
                    .collect(Collectors.joining(", "));

            return new ChatResponse(
                    "Mẫu này có nhiều biến thể. Bạn chọn rõ size và màu giúp mình nhé: " + available + ".",
                    toChatProducts(variants.stream().limit(4).toList())
            );
        }

        PublicItem chosen = variants.get(0);
        int quantity = plan.quantity() == null ? 1 : Math.max(1, plan.quantity());

        if (quantity > chosen.stock()) {
            return new ChatResponse(
                    "Biến thể này chỉ còn " + chosen.stock() + " sản phẩm, chưa đủ số lượng bạn muốn.",
                    toChatProducts(List.of(chosen))
            );
        }

        CartItemDTO dto = new CartItemDTO();
        dto.setUserId(userId);
        dto.setVariantId(chosen.variantId());
        dto.setQuantity(quantity);

        cartService.addToCart(dto);

        syncDisplayedProducts(context, List.of(chosen));
        context.focusedProductId = chosen.productId();

        return new ChatResponse(
                sanitizeCustomerReply(
                        "Đã thêm " + quantity + " " + chosen.name()
                                + " - size " + safe(chosen.size())
                                + " - màu " + safe(chosen.color())
                                + " vào giỏ hàng."
                ),
                toChatProducts(List.of(chosen))
        );
    }

    private ChatResponse cartView(Long userId, Catalog catalog, ChatContext context) {
        Cart cart = cartService.getCart(userId);
        List<CartItem> items = cart.getItems() == null ? List.of() : cart.getItems();

        if (items.isEmpty()) {
            clearProductContext(context);
            return new ChatResponse("Giỏ hàng của bạn hiện đang trống.", List.of());
        }

        Map<Long, PublicItem> byVariant = catalog.items().stream()
                .collect(Collectors.toMap(
                        PublicItem::variantId,
                        i -> i,
                        (a, b) -> a,
                        LinkedHashMap::new
                ));

        List<PublicItem> cards = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        int totalQty = 0;
        List<String> lines = new ArrayList<>();

        for (CartItem item : items) {
            if (item == null || item.getVariant() == null) continue;

            Long variantId = item.getVariant().getVariantId();
            PublicItem publicItem = byVariant.get(variantId);
            if (publicItem == null) continue;

            int qty = item.getQuantity() == null ? 0 : item.getQuantity();
            totalQty += qty;
            total = total.add(publicItem.price().multiply(BigDecimal.valueOf(qty)));

            lines.add(publicItem.name()
                    + " (" + safe(publicItem.size())
                    + ", " + safe(publicItem.color())
                    + ") × " + qty);

            if (cards.size() < MAX_CARDS) cards.add(publicItem);
        }

        String reply = "Giỏ hàng của bạn có " + totalQty + " sản phẩm: "
                + String.join("; ", lines)
                + ". Tạm tính " + formatMoney(total) + ".";

        // V9.1: card nào vừa hiển thị thì "mẫu 1, mẫu 2..." phải trỏ đúng card đó.
        syncDisplayedProducts(context, cards);

        return new ChatResponse(sanitizeCustomerReply(reply), toChatProducts(cards));
    }

    private ChatResponse cartUpdateOrRemove(
            String message,
            AiSearchPlan plan,
            Catalog catalog,
            ChatContext context,
            Long userId,
            String action
    ) throws Exception {

        Cart cart = cartService.getCart(userId);
        List<CartItem> cartItems = cart.getItems() == null ? List.of() : cart.getItems();

        if (cartItems.isEmpty()) {
            return new ChatResponse("Giỏ hàng của bạn hiện đang trống.", List.of());
        }

        Long rememberedProductId = resolveRememberedProductIds(plan, context, 1)
                .stream().findFirst().orElse(null);

        CartItem target = null;

        if (rememberedProductId != null) {
            List<CartItem> matched = cartItems.stream()
                    .filter(ci -> ci != null
                            && ci.getVariant() != null
                            && ci.getVariant().getProduct() != null
                            && Objects.equals(
                                    ci.getVariant().getProduct().getProductId(),
                                    rememberedProductId
                            ))
                    .toList();

            if (matched.size() == 1) {
                target = matched.get(0);
            } else if (!matched.isEmpty()) {
                target = chooseCartItemWithGroq(message, matched, catalog);
            }
        }

        if (target == null) {
            target = chooseCartItemWithGroq(message, cartItems, catalog);
        }

        if (target == null) {
            return new ChatResponse(
                    "Mình chưa xác định chắc chắn món nào trong giỏ bạn muốn thay đổi. Bạn nói rõ tên/mẫu giúp mình nhé.",
                    List.of()
            );
        }

        if (!cartService.isItemOwner(target.getCartItemId(), userId)) {
            return new ChatResponse("Bạn không có quyền thay đổi sản phẩm này.", List.of());
        }

        /*
         * target được gán ở nhiều nhánh phía trên nên không phải effectively final.
         * Chốt variantId thành biến final trước khi dùng trong lambda.
         */
        final Long targetVariantId =
                target.getVariant() == null
                        ? null
                        : target.getVariant().getVariantId();

        PublicItem card = catalog.items().stream()
                .filter(i -> targetVariantId != null
                        && Objects.equals(i.variantId(), targetVariantId))
                .findFirst()
                .orElse(null);

        if ("CART_REMOVE".equals(action)) {
            cartService.removeItem(target.getCartItemId());
            String name = card == null ? "sản phẩm" : card.name();

            // V9.1: không hiển thị lại món vừa xóa. Refresh giỏ để thứ tự mẫu được đánh lại.
            ChatResponse refreshed = cartView(userId, catalog, context);
            if (refreshed.products() == null || refreshed.products().isEmpty()) {
                return new ChatResponse(
                        "Đã xóa " + name + " khỏi giỏ hàng. Giỏ hàng của bạn hiện đang trống.",
                        List.of()
                );
            }
            return new ChatResponse(
                    "Đã xóa " + name + " khỏi giỏ hàng. " + refreshed.reply(),
                    refreshed.products()
            );
        }

        int quantity = plan.quantity() == null ? 1 : Math.max(1, plan.quantity());
        cartService.updateQuantity(target.getCartItemId(), quantity);

        String name = card == null ? "sản phẩm" : card.name();
        ChatResponse refreshed = cartView(userId, catalog, context);
        return new ChatResponse(
                "Đã cập nhật " + name + " thành " + quantity + " sản phẩm trong giỏ. " + refreshed.reply(),
                refreshed.products()
        );
    }

    /*
     * AI chỉ chọn cartItemId từ danh sách Java cung cấp.
     * Java vẫn kiểm tra owner trước khi update/remove.
     */
    private CartItem chooseCartItemWithGroq(
            String message,
            List<CartItem> cartItems,
            Catalog catalog
    ) throws Exception {

        Map<Long, PublicItem> byVariant = catalog.items().stream()
                .collect(Collectors.toMap(
                        PublicItem::variantId,
                        i -> i,
                        (a, b) -> a,
                        LinkedHashMap::new
                ));

        List<Map<String, Object>> rows = new ArrayList<>();

        for (CartItem ci : cartItems) {
            if (ci == null || ci.getVariant() == null) continue;
            PublicItem i = byVariant.get(ci.getVariant().getVariantId());
            if (i == null) continue;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("cartItemId", ci.getCartItemId());
            row.put("name", i.name());
            row.put("size", i.size());
            row.put("color", i.color());
            row.put("price", i.price());
            row.put("quantity", ci.getQuantity());
            rows.add(row);
        }

        if (rows.isEmpty()) return null;

        String prompt = """
                Bạn là Cart Target Resolver của JODOK.
                Chọn CHÍNH XÁC một cartItemId mà khách đang nhắc tới.
                Chỉ được dùng ID có trong CART_ITEMS.
                Không đoán nếu yêu cầu mơ hồ giữa nhiều món.

                Trả duy nhất JSON:
                {"cartItemId":null}

                CÂU KHÁCH:
                %s

                CART_ITEMS:
                %s
                """.formatted(message, objectMapper.writeValueAsString(rows));

        JsonNode node = callGroqJson(prompt);
        if (node == null || !node.path("cartItemId").canConvertToLong()) return null;

        long selectedId = node.path("cartItemId").asLong();

        return cartItems.stream()
                .filter(ci -> ci != null && Objects.equals(ci.getCartItemId(), selectedId))
                .findFirst()
                .orElse(null);
    }

    private String formatMoney(BigDecimal value) {
        if (value == null) return "0đ";
        return String.format(Locale.US, "%,.0fđ", value).replace(",", ".");
    }

    /*
     * V8.2 OUTFIT CANDIDATE TOOL
     *
     * Không dùng productToolScore() để quyết định "món nào hợp đi sinh nhật/đi biển/...".
     * Java chỉ áp dụng hard constraints an toàn:
     *   - sản phẩm/variant còn hàng
     *   - giá một món không vượt tổng ngân sách
     *   - size/brand chính xác nếu khách đã yêu cầu
     *
     * Sau đó lấy một pool đa dạng sản phẩm thật cho Groq semantic rerank.
     * Nhờ vậy một màu/keyword có điểm cao sẽ không đẩy toàn bộ áo/quần phù hợp ra khỏi candidates.
     */
    private List<PublicItem> runOutfitCandidateTool(
            AiSearchPlan plan,
            List<PublicItem> allItems
    ) {
        if (plan == null || allItems == null || allItems.isEmpty()) return List.of();

        BigDecimal budget = plan.totalBudget();

        List<PublicItem> eligible = allItems.stream()
                .filter(i -> i.stock() > 0)
                .filter(i -> budget == null || i.price().compareTo(budget) <= 0)
                .filter(i -> plan.size() == null || normalize(i.size()).equals(normalize(plan.size())))
                .filter(i -> plan.brand() == null || normalize(i.brand()).equals(normalize(plan.brand())))
                /*
                 * productType đã được AI planner hiểu theo ngữ nghĩa.
                 * Java chỉ thực thi constraint có cấu trúc, không parse raw message.
                 * Vì vậy khi planner nói khách cần "áo", các loại tất/giày/quần...
                 * không được lọt vào candidate chỉ vì còn hàng hoặc giá phù hợp.
                 */
                .filter(i -> plan.productType() == null || matchesPlannedProductType(i, plan.productType()))
                .toList();

        if (eligible.isEmpty()) return List.of();

        // Giữ nhiều variant màu khác nhau của cùng product, nhưng không để một product
        // chiếm toàn bộ context. Tối đa 3 variant/product.
        Map<Long, List<PublicItem>> byProduct = eligible.stream()
                .collect(Collectors.groupingBy(
                        PublicItem::productId,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        List<PublicItem> pool = new ArrayList<>();

        for (List<PublicItem> variants : byProduct.values()) {
            variants.stream()
                    .sorted(Comparator
                            .comparingInt((PublicItem i) -> outfitMechanicalScore(i, plan))
                            .reversed()
                            .thenComparing(PublicItem::price))
                    .limit(3)
                    .forEach(pool::add);
        }

        /*
         * Pool outfit cố ý rộng hơn SEARCH. Đây vẫn là dữ liệu DB thật và chỉ là
         * pre-selection cơ học. Groq ở bước sau mới quyết định semantic suitability.
         */
        return pool.stream()
                .sorted(Comparator
                        .comparingInt((PublicItem i) -> outfitMechanicalScore(i, plan))
                        .reversed()
                        .thenComparing(PublicItem::price))
                .limit(20)
                .toList();
    }

    /*
     * Chỉ ưu tiên các constraint trực tiếp, không encode quy tắc kiểu
     * "sinh nhật => polo", "đi biển => short"... trong Java.
     */
    private int outfitMechanicalScore(PublicItem item, AiSearchPlan plan) {
        int score = 0;

        if (plan.color() != null) {
            score += semanticFieldScore(
                    normalize(safe(item.color()) + " " + safe(item.name()) + " " + safe(item.description())),
                    plan.color(),
                    10
            );
        }

        if (plan.audience() != null) {
            score += semanticFieldScore(
                    normalize(safe(item.category()) + " " + safe(item.name()) + " " + safe(item.description())),
                    plan.audience(),
                    8
            );
        }

        if (plan.productType() != null) {
            score += semanticFieldScore(
                    normalize(safe(item.category()) + " " + safe(item.name())),
                    plan.productType(),
                    6
            );
        }

        if (plan.brand() != null && normalize(item.brand()).equals(normalize(plan.brand()))) {
            score += 6;
        }

        if (plan.size() != null && normalize(item.size()).equals(normalize(plan.size()))) {
            score += 5;
        }

        return score;
    }

    private List<PublicItem> runProductTool(
            AiSearchPlan plan,
            List<PublicItem> allItems
    ) {
        if (plan == null || allItems == null || allItems.isEmpty()) return List.of();

        BigDecimal itemMax = plan.maxPrice();
        if (itemMax == null && "OUTFIT".equalsIgnoreCase(plan.mode())) {
            itemMax = plan.totalBudget();
        }

        final BigDecimal maxAllowed = itemMax;

        List<PublicItem> hardFiltered = allItems.stream()
                .filter(i -> i.stock() > 0)
                .filter(i -> plan.minPrice() == null || i.price().compareTo(plan.minPrice()) >= 0)
                .filter(i -> maxAllowed == null || i.price().compareTo(maxAllowed) <= 0)
                .filter(i -> plan.size() == null || normalize(i.size()).equals(normalize(plan.size())))
                .filter(i -> plan.brand() == null || normalize(i.brand()).equals(normalize(plan.brand())))
                .filter(i -> plan.productType() == null || matchesPlannedProductType(i, plan.productType()))
                .toList();

        if (hardFiltered.isEmpty()) return List.of();

        Map<Long, PublicItem> bestVariantByProduct = new LinkedHashMap<>();

        hardFiltered.stream()
                .sorted(Comparator
                        .comparingInt((PublicItem i) -> productToolScore(i, plan))
                        .reversed()
                        .thenComparing(PublicItem::price))
                .forEach(item -> {
                    PublicItem old = bestVariantByProduct.get(item.productId());
                    if (old == null) {
                        bestVariantByProduct.put(item.productId(), item);
                        return;
                    }

                    int oldScore = productToolScore(old, plan);
                    int newScore = productToolScore(item, plan);

                    if (newScore > oldScore
                            || (newScore == oldScore && item.price().compareTo(old.price()) < 0)) {
                        bestVariantByProduct.put(item.productId(), item);
                    }
                });

        int limit = plan.candidateLimit() == null ? 12 : plan.candidateLimit();

        return bestVariantByProduct.values().stream()
                .sorted(Comparator
                        .comparingInt((PublicItem i) -> productToolScore(i, plan))
                        .reversed()
                        .thenComparing(PublicItem::price))
                .limit(limit)
                .toList();
    }

    /*
     * Đối chiếu productType CÓ CẤU TRÚC do AI planner trả về với metadata DB.
     * Hàm này không đọc câu khách.
     */
    private boolean matchesPlannedProductType(PublicItem item, String productType) {
        if (productType == null || productType.isBlank()) return true;

        String wanted = normalize(productType);
        String name = normalize(item.name());
        String category = normalize(item.category());

        if (wanted.isBlank()) return true;

        // Exact phrase trên tên hoặc category là tín hiệu mạnh nhất.
        if (containsPhrase(name, wanted) || containsPhrase(category, wanted)) {
            return true;
        }

        /*
         * Planner đôi khi trả loại tổng quát ("áo") trong khi DB lưu
         * "áo thun", "áo ba lỗ", "áo chống nắng"... Phrase "ao" vẫn match.
         * Với cụm nhiều từ, yêu cầu toàn bộ token của productType xuất hiện
         * trong name/category để tránh kéo sản phẩm khác loại vào.
         */
        String haystack = " " + name + " " + category + " ";
        for (String token : wanted.split(" ")) {
            if (token.length() < 2) continue;
            if (!haystack.contains(" " + token + " ")) return false;
        }
        return true;
    }

    /*
     * Đây không phải parser câu khách. Planner AI đã chuyển câu tự nhiên thành
     * các trường semantic có cấu trúc. Hàm này chỉ đối chiếu các trường đó với
     * metadata công khai của sản phẩm để giảm catalog xuống tập ứng viên nhỏ.
     */
    private int productToolScore(PublicItem item, AiSearchPlan plan) {
        String haystack = normalize(
                safe(item.name()) + " "
                        + safe(item.category()) + " "
                        + safe(item.brand()) + " "
                        + safe(item.description()) + " "
                        + safe(item.color()) + " "
                        + safe(item.size())
        );

        int score = 0;
        score += semanticFieldScore(haystack, plan.productType(), 24);
        score += semanticFieldScore(haystack, plan.audience(), 20);
        score += semanticFieldScore(haystack, plan.color(), 16);
        score += semanticFieldScore(haystack, plan.occasion(), 10);
        score += semanticFieldScore(haystack, plan.style(), 8);

        if (plan.brand() != null && normalize(item.brand()).equals(normalize(plan.brand()))) {
            score += 20;
        }

        if (plan.size() != null && normalize(item.size()).equals(normalize(plan.size()))) {
            score += 12;
        }

        if (plan.semanticQuery() != null) {
            Set<String> queryTerms = Arrays.stream(normalize(plan.semanticQuery()).split(" "))
                    .filter(s -> s.length() >= 2)
                    .collect(Collectors.toCollection(LinkedHashSet::new));

            for (String term : queryTerms) {
                if ((" " + haystack + " ").contains(" " + term + " ")) {
                    score += 2;
                }
            }
        }

        return score;
    }

    private int semanticFieldScore(String haystack, String value, int weight) {
        if (value == null || value.isBlank()) return 0;

        String normalizedValue = normalize(value);
        if (normalizedValue.isBlank()) return 0;

        if ((" " + haystack + " ").contains(" " + normalizedValue + " ")) {
            return weight;
        }

        int matched = 0;
        int total = 0;

        for (String token : normalizedValue.split(" ")) {
            if (token.length() < 2) continue;
            total++;
            if ((" " + haystack + " ").contains(" " + token + " ")) {
                matched++;
            }
        }

        if (total == 0) return 0;
        return (int) Math.round(weight * (matched / (double) total));
    }

    private AiSelection selectCandidatesWithGroq(
            String message,
            String history,
            AiSearchPlan plan,
            List<PublicItem> candidates
    ) throws Exception {

        String candidateJson = objectMapper.writeValueAsString(
                candidates.stream().map(i -> Map.of(
                        "productId", i.productId(),
                        "variantId", i.variantId(),
                        "name", safe(i.name()),
                        "category", safe(i.category()),
                        "brand", safe(i.brand()),
                        "description", shortenForAi(i.description(), 80),
                        "price", i.price(),
                        "size", safe(i.size()),
                        "color", safe(i.color()),
                        "stock", i.stock()
                )).toList()
        );

        String planJson = objectMapper.writeValueAsString(plan);

        String prompt = """
                Bạn là AI Stylist/Sales của JODOK.
                Java Product Tool đã tìm một TẬP ỨNG VIÊN NHỎ từ database thật.
                Hãy chọn đúng sản phẩm/variant từ danh sách này và viết câu trả lời.

                QUY TẮC:
                - Chỉ dùng productId + variantId có trong CANDIDATES.
                - Không bịa giá, tồn kho, size, màu, thương hiệu, chất liệu.
                - Nếu yêu cầu là SEARCH: chọn tối đa 8 kết quả sát yêu cầu nhất.
                - Khi viết reply, phải mô tả ĐÚNG constraint trong SEARCH PLAN:
                  nếu có cả minPrice và maxPrice thì nói "khoảng/tầm ...", KHÔNG được nói "dưới".
                  Chỉ nói "dưới/không quá" khi minPrice=null và có maxPrice.
                - Nếu plan.productType khác null, tuyệt đối không chọn sản phẩm khác loại.
                - Nếu yêu cầu là OUTFIT: đây là bước SEMANTIC RERANK quan trọng.
                  Hãy đánh giá từng candidate theo đối tượng, dịp, phong cách, màu và khả năng phối cùng nhau.
                - OUTFIT phải là một bộ hợp lý, không phải các món có keyword giống câu khách.
                - Với outfit dùng áo + quần/váy rời: tối đa 1 món thân trên + 1 món thân dưới
                  + 1 giày/dép/phụ kiện phù hợp.
                - Với váy/đầm liền thân: tối đa 1 váy/đầm chính + giày/dép/phụ kiện; không thêm
                  váy/đầm thứ hai vào cùng bộ.
                - Không chọn nhiều món cạnh tranh cùng vai trò chỉ để đủ số lượng.
                - Không chọn món rõ ràng lệch dịp chỉ vì đúng màu hoặc rẻ.
                  Ví dụ dịp sinh nhật/tiệc thông thường không nên ưu tiên quần đùi gió,
                  dép chống trượt hoặc đồ tập nếu catalog còn lựa chọn lịch sự/phù hợp hơn.
                - Màu là một tiêu chí, KHÔNG được lấn át occasion/audience.
                - Tổng giá outfit phải <= totalBudget nếu plan có totalBudget.
                - Ưu tiên 2-3 món phối được với nhau; nếu chỉ có 1-2 món thật sự hợp thì chỉ chọn
                  1-2 món và nói rõ shop còn thiếu món nào.
                - Nếu dữ liệu không đủ để tạo outfit hợp lý, chọn phần phù hợp thật sự và
                  nói rõ shop còn thiếu món nào. Không lấp bằng sản phẩm vô lý.
                - Thông tin khách đã nói trong CÂU HIỆN TẠI không được hỏi lại.
                - Với màu kiểu "màu tối", hãy đánh giá ngữ nghĩa màu của candidate; không
                  bắt buộc phải đúng một tên màu duy nhất.
                - Có thể trả selectedItems=[] nếu không candidate nào thực sự phù hợp.
                - reply bằng tiếng Việt tự nhiên, tối đa khoảng 120 từ.
                - TUYỆT ĐỐI không viết productId, variantId, ID nội bộ, tên field kỹ thuật
                  hoặc JSON kỹ thuật vào reply cho khách.

                Trả DUY NHẤT JSON:
                {
                  "reply":"...",
                  "selectedItems":[
                    {"productId":1,"variantId":10}
                  ]
                }

                SEARCH PLAN:
                %s

                LỊCH SỬ:
                %s

                CÂU HIỆN TẠI:
                %s

                CANDIDATES TỪ PRODUCT TOOL:
                %s
                """.formatted(planJson, history, message, candidateJson);

        System.out.println("[CHATBOT][V8.2.1][SELECTOR] mode="
                + upper(plan.mode(), "SEARCH")
                + ", candidates=" + candidates.size()
                + ", candidateJsonChars=" + candidateJson.length());

        JsonNode node = callGroqJson(prompt);
        if (node == null || !node.isObject()) return null;

        List<SelectedAiItem> selected = new ArrayList<>();
        JsonNode selectedItems = node.path("selectedItems");

        if (selectedItems.isArray()) {
            for (JsonNode item : selectedItems) {
                JsonNode productId = item.get("productId");
                JsonNode variantId = item.get("variantId");

                if (productId != null && productId.canConvertToLong()
                        && variantId != null && variantId.canConvertToLong()) {
                    selected.add(new SelectedAiItem(
                            productId.asLong(),
                            variantId.asLong()
                    ));
                }

                if (selected.size() >= MAX_CARDS) break;
            }
        }

        return new AiSelection(
                cleanNullable(node.path("reply").asText(null)),
                selected
        );
    }

    /*
     * Lớp bảo vệ cuối: kể cả model lỡ đưa ID kỹ thuật vào câu trả lời,
     * backend sẽ xóa trước khi gửi ra UI khách hàng.
     */
    private String sanitizeCustomerReply(String value) {
        if (value == null) return "";

        String cleaned = value
                .replaceAll("(?i)\\s*\\(?\\s*productId\\s*[:=#]?\\s*\\d+\\s*,?\\s*variantId\\s*[:=#]?\\s*\\d+\\s*\\)?", "")
                .replaceAll("(?i)\\s*\\(?\\s*variantId\\s*[:=#]?\\s*\\d+\\s*,?\\s*productId\\s*[:=#]?\\s*\\d+\\s*\\)?", "")
                .replaceAll("(?i)\\bproductId\\s*[:=#]?\\s*\\d+\\b", "")
                .replaceAll("(?i)\\bvariantId\\s*[:=#]?\\s*\\d+\\b", "")
                .replaceAll("\\s+([,.;:!?])", "$1")
                .replaceAll("[ \\t]{2,}", " ")
                .trim();

        return cleaned;
    }

    private String upper(String value, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private record SelectedAiItem(Long productId, Long variantId) {}

    private List<PublicItem> verifyGroqSelectedItems(
            List<SelectedAiItem> requestedItems,
            List<PublicItem> catalogItems
    ) {
        if (requestedItems == null || requestedItems.isEmpty()) return List.of();

        Map<Long, PublicItem> byVariantId = catalogItems.stream()
                .filter(i -> i.variantId() != null)
                .collect(Collectors.toMap(
                        PublicItem::variantId,
                        i -> i,
                        (a, b) -> a,
                        LinkedHashMap::new
                ));

        List<PublicItem> result = new ArrayList<>();
        Set<Long> usedProducts = new HashSet<>();
        Set<Long> usedVariants = new HashSet<>();

        for (SelectedAiItem selected : requestedItems) {
            if (selected == null
                    || selected.productId() == null
                    || selected.variantId() == null
                    || !usedVariants.add(selected.variantId())) {
                continue;
            }

            PublicItem item = byVariantId.get(selected.variantId());

            // Java chỉ xác minh dữ liệu thật: variant phải tồn tại, đúng product và còn hàng.
            if (item == null
                    || !Objects.equals(item.productId(), selected.productId())
                    || item.stock() <= 0
                    || !usedProducts.add(item.productId())) {
                continue;
            }

            result.add(item);
            if (result.size() >= MAX_CARDS) break;
        }

        return result;
    }

    private String buildCompactCatalogJson(Catalog catalog) throws Exception {
        Map<Long, List<PublicItem>> grouped = catalog.items().stream()
                .filter(i -> i.stock() > 0)
                .collect(Collectors.groupingBy(
                        PublicItem::productId,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        List<Map<String, Object>> products = new ArrayList<>();

        for (Map.Entry<Long, List<PublicItem>> entry : grouped.entrySet()) {
            List<PublicItem> variants = entry.getValue();
            if (variants.isEmpty()) continue;

            PublicItem first = variants.get(0);

            Map<String, Object> p = new LinkedHashMap<>();
            p.put("productId", first.productId());
            p.put("name", first.name());
            p.put("category", first.category());
            p.put("brand", first.brand());
            p.put("description", shortenForAi(first.description(), MAX_AI_DESCRIPTION_CHARS));

            List<Map<String, Object>> variantData = variants.stream()
                    .filter(v -> v.stock() > 0)
                    .sorted(Comparator.comparing(PublicItem::price))
                    .limit(16)
                    .map(v -> {
                        Map<String, Object> row = new LinkedHashMap<>();
                        row.put("variantId", v.variantId());
                        row.put("price", v.price());
                        row.put("size", v.size());
                        row.put("color", v.color());
                        row.put("stock", v.stock());
                        return row;
                    })
                    .toList();

            p.put("variants", variantData);
            products.add(p);

            if (products.size() >= MAX_AI_CATALOG_PRODUCTS) break;
        }

        return objectMapper.writeValueAsString(products);
    }

    private String shortenForAi(String value, int maxLength) {
        if (value == null) return "";
        String clean = value.replaceAll("\\s+", " ").trim();
        if (clean.length() <= maxLength) return clean;
        return clean.substring(0, maxLength) + "...";
    }

    private void rememberTurn(ChatContext context, String turn) {
        if (turn == null || turn.isBlank()) return;
        context.recentTurns.add(shortenForAi(turn, 350));
        while (context.recentTurns.size() > MAX_AI_HISTORY_TURNS) {
            context.recentTurns.remove(0);
        }
    }



    private SearchRequest parseIntentWithGroq(

            String message,

            ChatContext context,

            Catalog catalog

    ) throws Exception {



        String previous = context.lastRequest == null

                ? "Không có"

                : objectMapper.writeValueAsString(context.lastRequest);



        String prompt = """

                Bạn là bộ phân tích ý định tìm sản phẩm thời trang.

                Chỉ phân tích câu khách, KHÔNG tự tạo dữ liệu sản phẩm.



                Hãy trả JSON đúng cấu trúc:

                {

                  "minPrice": number|null,

                  "maxPrice": number|null,

                  "size": string|null,

                  "color": string|null,

                  "audience": "nam"|"nu"|"be trai"|"be gai"|"tre em"|null,

                  "stockOnly": boolean,

                  "productType": string|null,

                  "brand": string|null,

                  "occasion": string|null,

                  "sort": "CHEAPEST"|"EXPENSIVE"|"RELEVANT"|null,

                  "exactPrice": boolean

                }



                Quy tắc:

                - "áo 100k", "áo tầm 100k", "quanh 100k": minPrice=80000, maxPrice=120000.

                - "dưới 100k": maxPrice=100000.

                - "trên 100k": minPrice=100000.

                - "đúng 100k": minPrice=maxPrice=100000 và exactPrice=true.

                - "từ 100k đến 200k": minPrice=100000, maxPrice=200000.

                - 1k = 1000; 1 triệu = 1000000.

                - Chỉ lấy brand nếu khách thực sự nhắc đến.

                - Nếu khách không nói điều kiện nào thì để null/false.

                - Không tự suy đoán size, màu, giới tính.

                - "rẻ nhất" => sort=CHEAPEST; "đắt nhất" => sort=EXPENSIVE.

                - Trả JSON duy nhất, không markdown.



                YÊU CẦU TRƯỚC:

                """ + previous + """



                CÂU HIỆN TẠI:

                """ + message;



        JsonNode answer = callGroqJson(prompt);

        if (answer == null) return null;



        BigDecimal min = decimalOrNull(answer.get("minPrice"));

        BigDecimal max = decimalOrNull(answer.get("maxPrice"));



        if (min != null && min.signum() < 0) min = null;

        if (max != null && max.signum() < 0) max = null;

        if (min != null && max != null && min.compareTo(max) > 0) {

            BigDecimal temp = min;

            min = max;

            max = temp;

        }



        String requestedBrand =

                cleanNullable(answer.path("brand").asText(null));



        String brand = null;



        if (requestedBrand != null) {



        final String brandToFind =

                normalize(requestedBrand);



        brand = catalog.brands().stream()

                .filter(Objects::nonNull)

                .filter(b ->

                        normalize(b).equals(brandToFind)

                )

                .findFirst()

                .orElse(null);

        }



        return new SearchRequest(

                min,

                max,

                cleanNullable(answer.path("size").asText(null)),

                cleanNullable(answer.path("color").asText(null)),

                cleanNullable(answer.path("audience").asText(null)),

                answer.path("stockOnly").asBoolean(false),

                cleanNullable(answer.path("productType").asText(null)),

                brand,

                cleanNullable(answer.path("occasion").asText(null)),

                cleanNullable(answer.path("sort").asText(null)),

                answer.path("exactPrice").asBoolean(false)

        );

    }



    private SearchRequest parseLocally(String message, Catalog catalog) {

        String text = normalize(message);



        BigDecimal minPrice = null;

        BigDecimal maxPrice = null;

        boolean exactPrice = false;



        List<BigDecimal> prices = extractPrices(text);



        if (prices.size() >= 2 && (containsPhrase(text, "tu") || containsPhrase(text, "den"))) {

            minPrice = prices.get(0).min(prices.get(1));

            maxPrice = prices.get(0).max(prices.get(1));

        } else if (!prices.isEmpty()) {

            BigDecimal p = prices.get(0);



            if (containsPhrase(text, "duoi")

                    || containsPhrase(text, "khong qua")

                    || containsPhrase(text, "toi da")

                    || containsPhrase(text, "tro xuong")) {

                maxPrice = p;

            } else if (containsPhrase(text, "tren")

                    || containsPhrase(text, "toi thieu")

                    || containsPhrase(text, "tro len")) {

                minPrice = p;

            } else if (containsPhrase(text, "dung")

                    || containsPhrase(text, "chinh xac")) {

                minPrice = p;

                maxPrice = p;

                exactPrice = true;

            } else {

                minPrice = p.multiply(new BigDecimal("0.80"));

                maxPrice = p.multiply(new BigDecimal("1.20"));

            }

        }



        String size = null;

        Matcher sizeMatcher = Pattern.compile(

                "\\bsize\\s*(xxxl|xxl|xl|xs|s|m|l|\\d{2,3})\\b"

        ).matcher(text);

        if (sizeMatcher.find()) {

            size = sizeMatcher.group(1).toUpperCase(Locale.ROOT);

        }



        String color = detectColor(text);



        String audience = null;

        if (containsPhrase(text, "be trai")) audience = "be trai";

        else if (containsPhrase(text, "be gai")) audience = "be gai";

        else if (containsPhrase(text, "tre em")) audience = "tre em";

        else if (containsPhrase(text, "nam")) audience = "nam";

        else if (containsPhrase(text, "nu")) audience = "nu";



        String productType = detectProductType(text);

        String brand = detectBrand(text, catalog.brands());



        String sort = null;

        if (containsPhrase(text, "re nhat")) sort = "CHEAPEST";

        else if (containsPhrase(text, "dat nhat")) sort = "EXPENSIVE";



        return new SearchRequest(

                minPrice,

                maxPrice,

                size,

                color,

                audience,

                containsPhrase(text, "con hang") || containsPhrase(text, "co san"),

                productType,

                brand,

                detectOccasion(text),

                sort,

                exactPrice

        );

    }



    private List<BigDecimal> extractPrices(String text) {

        Pattern pattern = Pattern.compile(

                "\\b(\\d+(?:[.,]\\d+)?)\\s*(trieu|nghin|ngan|k|dong|d)\\b"

        );

        Matcher matcher = pattern.matcher(text);

        List<BigDecimal> result = new ArrayList<>();



        while (matcher.find()) {

            try {

                BigDecimal number = new BigDecimal(matcher.group(1).replace(',', '.'));

                String unit = matcher.group(2);



                if ("trieu".equals(unit)) {

                    number = number.multiply(BigDecimal.valueOf(1_000_000));

                } else if ("nghin".equals(unit) || "ngan".equals(unit) || "k".equals(unit)) {

                    number = number.multiply(BigDecimal.valueOf(1_000));

                }



                result.add(number);

            } catch (NumberFormatException ignored) {

            }

        }



        return result;

    }



    private List<PublicItem> findMatches(

            List<PublicItem> items,

            SearchRequest request,

            ChatContext context

    ) {

        List<PublicItem> matches = new ArrayList<>();



        for (PublicItem item : items) {

            if (request.minPrice() != null && item.price().compareTo(request.minPrice()) < 0) continue;

            if (request.maxPrice() != null && item.price().compareTo(request.maxPrice()) > 0) continue;

            if (request.stockOnly() && item.stock() <= 0) continue;



            if (request.size() != null

                    && !normalize(item.size()).equals(normalize(request.size()))) continue;



            if (request.color() != null

                    && !containsPhrase(item.color(), request.color())) continue;



            if (request.brand() != null

                    && !normalize(item.brand()).equals(normalize(request.brand()))) continue;



            if (!matchesAudience(item, request.audience())) continue;

            if (!matchesProductType(item, request.productType())) continue;



            matches.add(item);

        }



        Comparator<PublicItem> comparator;



        if ("CHEAPEST".equalsIgnoreCase(request.sort())) {

            comparator = Comparator.comparing(PublicItem::price);

        } else if ("EXPENSIVE".equalsIgnoreCase(request.sort())) {

            comparator = Comparator.comparing(PublicItem::price).reversed();

        } else {

            comparator = Comparator

                    .comparingInt((PublicItem item) -> relevanceScore(item, request))

                    .reversed()

                    .thenComparing((PublicItem item) -> item.stock() > 0 ? 0 : 1)

                    .thenComparing(PublicItem::price);

        }



        matches.sort(comparator);

        return matches;

    }



    private int relevanceScore(PublicItem item, SearchRequest request) {
        int score = item.stock() > 0 ? 3 : 0;

        if (request.productType() != null) {
            if (containsPhrase(item.name(), request.productType())) score += 10;
            else if (containsPhrase(item.category(), request.productType())) score += 6;
        }

        if (request.audience() != null && matchesAudience(item, request.audience())) score += 8;
        score += occasionScore(item, request.occasion());
        return score;
    }

    private int occasionScore(PublicItem item, String occasion) {
        if (occasion == null || occasion.isBlank()) return 0;

        String o = normalize(occasion);
        String h = normalize(safe(item.name()) + " " + safe(item.category()) + " " + safe(item.description()));
        int score = containsPhrase(h, o) ? 12 : 0;

        if (containsPhrase(o, "van dong") || containsPhrase(o, "the thao") || containsPhrase(o, "tap luyen")) {
            if (containsPhrase(h, "the thao")) score += 12;
            if (containsPhrase(h, "ao thun") || containsPhrase(h, "ao phong") || containsPhrase(h, "quan short")) score += 5;
            if (containsPhrase(h, "vay") || containsPhrase(h, "dam") || containsPhrase(h, "so mi")) score -= 8;
        }
        if (containsPhrase(o, "sinh nhat") || containsPhrase(o, "du tiec") || containsPhrase(o, "hen ho")) {
            if (containsPhrase(h, "tiec")) score += 8;
            if (containsPhrase(h, "so mi") || containsPhrase(h, "polo")) score += 5;
            if (containsPhrase(h, "di bien")) score -= 5;
        }
        if (containsPhrase(o, "di lam") || containsPhrase(o, "phong van")) {
            if (containsPhrase(h, "so mi") || containsPhrase(h, "polo") || containsPhrase(h, "quan tay")) score += 7;
            if (containsPhrase(h, "di bien")) score -= 6;
        }
        if (containsPhrase(o, "di bien") && (containsPhrase(h, "di bien") || containsPhrase(h, "short"))) score += 8;

        return score;
    }



    private ChatResponse answerFocusedProduct(

            String message,

            Catalog catalog,

            ChatContext context

    ) {

        List<PublicItem> variants = catalog.items().stream()

                .filter(i -> Objects.equals(i.productId(), context.focusedProductId))

                .toList();



        if (variants.isEmpty()) {

            context.focusedProductId = null;

            return new ChatResponse("Mẫu bạn hỏi hiện không còn trong danh mục đang mở bán.", List.of());

        }



        SearchRequest request = parseLocally(message, catalog);

        List<PublicItem> filtered = variants.stream()

                .filter(i -> request.size() == null

                        || normalize(i.size()).equals(normalize(request.size())))

                .filter(i -> request.color() == null

                        || containsPhrase(i.color(), request.color()))

                .filter(i -> request.minPrice() == null

                        || i.price().compareTo(request.minPrice()) >= 0)

                .filter(i -> request.maxPrice() == null

                        || i.price().compareTo(request.maxPrice()) <= 0)

                .toList();



        if (filtered.isEmpty()) {

            return new ChatResponse(

                    variants.get(0).name() + " hiện chưa có biến thể khớp với yêu cầu bạn vừa hỏi.",

                    List.of()

            );

        }



        PublicItem chosen = filtered.stream()

                .filter(i -> i.stock() > 0)

                .findFirst()

                .orElse(filtered.get(0));



        StringBuilder reply = new StringBuilder("Mẫu ")

                .append(chosen.name());



        if (request.size() != null) reply.append(" size ").append(request.size());

        if (request.color() != null) reply.append(" màu ").append(request.color());



        reply.append(chosen.stock() > 0

                ? " hiện còn hàng."

                : " hiện đang hết hàng.");



        return new ChatResponse(reply.toString(), List.of(toChatProduct(chosen)));

    }



    private SearchRequest mergeRequests(

            SearchRequest previous,

            SearchRequest current,

            String text

    ) {

        return new SearchRequest(

                current.minPrice() != null ? current.minPrice() : previous.minPrice(),

                current.maxPrice() != null ? current.maxPrice() : previous.maxPrice(),

                current.size() != null ? current.size() : previous.size(),

                current.color() != null ? current.color() : previous.color(),

                current.audience() != null ? current.audience() : previous.audience(),

                current.stockOnly() || previous.stockOnly(),

                current.productType() != null ? current.productType() : previous.productType(),

                current.brand() != null ? current.brand() : previous.brand(),

                current.occasion() != null ? current.occasion() : previous.occasion(),

                current.sort() != null ? current.sort() : previous.sort(),

                current.exactPrice()

        );

    }



    private String askWriterSafely(String message, List<PublicItem> selected) {

        if (!groqAvailable()) return "";



        try {

            String productJson = objectMapper.writeValueAsString(

                    selected.stream().limit(MAX_AI_ITEMS).toList()

            );



            String prompt = """

                    Bạn là trợ lý bán hàng JODOK.

                    Viết tối đa 2 câu tiếng Việt tự nhiên để hỗ trợ khách.



                    Quy tắc bắt buộc:

                    - Chỉ dựa trên dữ liệu sản phẩm được cung cấp.

                    - Không tự tạo giá, size, màu, tồn kho, thương hiệu hay chính sách.

                    - Không nói số lượng kết quả hoặc khoảng giá; Java sẽ hiển thị phần đó.

                    - Không liệt kê lại toàn bộ sản phẩm.

                    - Nếu mô tả không đủ căn cứ thì không suy đoán chất liệu/công dụng.

                    - Chỉ trả JSON {"reply":"..."}.



                    SẢN PHẨM:

                    """ + productJson + """



                    KHÁCH HỎI:

                    """ + message;



            JsonNode result = callGroqJson(prompt);

            return result == null ? "" : result.path("reply").asText("").trim();



        } catch (RestClientResponseException ex) {

            handleGroqHttpError(ex);

            return "";

        } catch (Exception ex) {

            System.err.println("Groq writer error: " + ex.getClass().getSimpleName());

            return "";

        }

    }



    private JsonNode callGroqJson(String prompt) throws Exception {

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", List.of(
                Map.of(
                        "role", "system",
                        "content", "Bạn là trợ lý mua sắm JODOK. Luôn trả về đúng một JSON object hợp lệ theo schema được yêu cầu."
                ),
                Map.of(
                        "role", "user",
                        "content", prompt
                )
        ));
        body.put("temperature", 0.1);
        body.put("max_completion_tokens", 700);
        body.put("reasoning_effort", "low");
        body.put("response_format", Map.of("type", "json_object"));

        System.out.println("[CHATBOT][V8.2.1][GROQ] promptChars=" + prompt.length());

        String response = restClient.post()
                .uri("https://api.groq.com/openai/v1/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);

        if (response == null || response.isBlank()) return null;

        JsonNode root = objectMapper.readTree(response);
        JsonNode choice = root.path("choices").path(0);

        if (choice.isMissingNode() || choice.isNull()) {
            System.err.println("[CHATBOT][GROQ] response không có choices[0]");
            return null;
        }

        String finishReason = choice.path("finish_reason").asText("");
        if ("length".equalsIgnoreCase(finishReason)) {
            System.err.println("[CHATBOT][GROQ] response bị cắt do giới hạn output token.");
            return null;
        }

        String json = choice.path("message").path("content").asText("").trim();
        if (json.isBlank()) {
            System.err.println("[CHATBOT][GROQ] message.content rỗng");
            return null;
        }

        return parseGroqJsonSafely(json);
    }


    private JsonNode parseGroqJsonSafely(String raw) throws Exception {
        if (raw == null || raw.isBlank()) return null;

        String cleaned = raw.trim()
                .replaceFirst("^```(?:json)?\\s*", "")
                .replaceFirst("\\s*```$", "")
                .trim();

        try {
            return objectMapper.readTree(cleaned);
        } catch (Exception first) {
            int start = cleaned.indexOf('{');
            int end = cleaned.lastIndexOf('}');
            if (start >= 0 && end > start) {
                try {
                    return objectMapper.readTree(cleaned.substring(start, end + 1));
                } catch (Exception ignored) {
                }
            }

            System.err.println("[CHATBOT][AI_JSON] invalid/truncated JSON, length=" + cleaned.length());
            throw first;
        }
    }

    private ChatResponse answerContextualFallback(
            String message,
            Catalog catalog,
            ChatContext context
    ) {
        String text = normalize(message);
        SearchRequest current = parseLocally(message, catalog);

        if (current.audience() != null) context.pendingAudience = current.audience();
        if (current.occasion() != null) context.pendingOccasion = current.occasion();
        if (current.color() != null) context.pendingColor = current.color();

        BigDecimal budget = extractConversationalBudget(text);
        if (budget != null) context.pendingBudget = budget;

        boolean stylingIntent = looksLikeOutfitRequest(text)
                || looksLikeGeneralFashionAdvice(text)
                || current.occasion() != null
                || context.pendingOccasion != null;

        // Một câu ngắn như "nam nhé", "500k thôi", "màu đen" chỉ được coi là follow-up
        // nếu trước đó đang có một nhu cầu tư vấn.
        boolean shortFollowUp = context.pendingOccasion != null
                && (current.audience() != null || budget != null || current.color() != null
                || text.length() <= 30);

        if (!stylingIntent && !shortFollowUp) return null;

        if (context.pendingAudience == null) {
            return new ChatResponse(
                    "Bạn muốn mình tư vấn đồ nam, nữ hay trẻ em để mình chọn đúng sản phẩm nhé?",
                    List.of()
            );
        }

        SearchRequest merged = new SearchRequest(
                null,
                context.pendingBudget,
                current.size(),
                context.pendingColor,
                context.pendingAudience,
                true,
                current.productType(),
                current.brand(),
                context.pendingOccasion,
                "RELEVANT",
                false
        );

        List<PublicItem> matches = findMatches(catalog.items(), merged, context).stream()
                .filter(i -> i.stock() > 0)
                .toList();

        List<PublicItem> selected = selectDistinctProducts(matches);
        if (selected.isEmpty()) {
            StringBuilder msg = new StringBuilder("Mình chưa tìm thấy sản phẩm còn hàng phù hợp");
            if (context.pendingAudience != null) msg.append(" cho ").append(audienceLabel(context.pendingAudience));
            if (context.pendingOccasion != null) msg.append(" để ").append(context.pendingOccasion);
            if (context.pendingBudget != null) msg.append(" trong ngân sách ").append(formatPrice(context.pendingBudget));
            msg.append(". Bạn thử tăng ngân sách hoặc đổi màu/kiểu đồ nhé.");
            return new ChatResponse(msg.toString(), List.of());
        }

        updateProductContext(context, selected);

        StringBuilder reply = new StringBuilder("Mình đang giữ yêu cầu");
        if (context.pendingAudience != null) reply.append(" đồ ").append(audienceLabel(context.pendingAudience));
        if (context.pendingOccasion != null) reply.append(" để ").append(context.pendingOccasion);
        if (context.pendingBudget != null) reply.append(", ngân sách tối đa khoảng ").append(formatPrice(context.pendingBudget));
        if (context.pendingColor != null) reply.append(", màu ").append(context.pendingColor);
        reply.append(". Đây là các mẫu còn hàng phù hợp nhất mình tìm được từ dữ liệu shop.");

        return new ChatResponse(reply.toString(), toChatProducts(selected));
    }

    private BigDecimal extractConversationalBudget(String text) {
        List<BigDecimal> prices = extractPrices(text);
        if (prices.isEmpty()) return null;

        if (containsPhrase(text, "tam")
                || containsPhrase(text, "khoang")
                || containsPhrase(text, "ngan sach")
                || containsPhrase(text, "budget")
                || containsPhrase(text, "toi da")
                || containsPhrase(text, "khong qua")
                || containsPhrase(text, "thoi")
                || text.matches(".*\\b\\d+(?:[.,]\\d+)?\\s*(?:k|nghin|ngan|trieu|dong|d)\\b.*")) {
            return prices.get(0);
        }
        return null;
    }

    private boolean groqAvailable() {

        return apiKey != null

                && !apiKey.isBlank()

                && System.currentTimeMillis() >= groqPauseUntil;

    }



    private void handleGroqHttpError(RestClientResponseException ex) {

        int status = ex.getStatusCode().value();

        if (status == 429) {
            long cooldownMs = 60_000L;

            try {
                String retryAfter = ex.getResponseHeaders() == null
                        ? null
                        : ex.getResponseHeaders().getFirst("Retry-After");

                if (retryAfter != null && !retryAfter.isBlank()) {
                    long seconds = Long.parseLong(retryAfter.trim());
                    cooldownMs = Math.max(cooldownMs, seconds * 1000L);
                }
            } catch (Exception ignored) {
            }

            groqPauseUntil = System.currentTimeMillis() + cooldownMs;

            System.err.println(
                    "[CHATBOT][GROQ_429] Groq đang giới hạn tốc độ. "
                            + "Tạm ngưng gọi AI khoảng " + (cooldownMs / 1000L) + " giây. "
                            + "Không dùng parser Java."
            );
            return;
        }

        if (status == 401 || status == 403) {
            System.err.println("[CHATBOT][GROQ_AUTH] Kiểm tra GROQ_API_KEY. HTTP " + status);
            return;
        }

        String groqErrorBody = "";
        try {
            groqErrorBody = ex.getResponseBodyAsString();
        } catch (Exception ignored) {
        }

        if (groqErrorBody != null && groqErrorBody.length() > 1200) {
            groqErrorBody = groqErrorBody.substring(0, 1200) + "...";
        }

        System.err.println("[CHATBOT][GROQ_HTTP] status=" + status
                + (groqErrorBody == null || groqErrorBody.isBlank()
                ? ""
                : " body=" + groqErrorBody));
    }

    private Catalog loadPublicCatalog() {

        Map<Long, Product> products = new LinkedHashMap<>();



        for (Product product : productRepository.findAll()) {

            if (product.getProductId() == null

                    || !isActive(product.getStatus())

                    || !isPublicCategory(product.getCategory())) continue;



            products.put(product.getProductId(), product);

        }



        List<PublicItem> items = new ArrayList<>();

        Set<String> categories = new LinkedHashSet<>();

        Set<String> brands = new LinkedHashSet<>();



        for (ProductVariant variant : variantRepository.findAll()) {

            if (variant.getVariantId() == null

                    || !isActive(variant.getStatus())

                    || variant.getProduct() == null

                    || variant.getProduct().getProductId() == null) continue;



            Product product = products.get(variant.getProduct().getProductId());

            if (product == null) continue;



            BigDecimal price = variant.getPrice() != null

                    ? variant.getPrice()

                    : product.getBasePrice();



            if (price == null || price.signum() < 0) continue;



            String category = getCategoryPath(product.getCategory());

            String brand = getPublicBrandName(product.getBrand());



            if (!category.isBlank()) categories.add(category);

            if (brand != null && !brand.isBlank()) brands.add(brand);



            items.add(new PublicItem(

                    product.getProductId(),

                    variant.getVariantId(),

                    product.getProductName(),

                    product.getDescription(),

                    category,

                    brand,

                    price,

                    variant.getSize(),

                    variant.getColor(),

                    variant.getStock() == null ? 0 : Math.max(0, variant.getStock())

            ));

        }



        return new Catalog(items, categories, brands);

    }



    private List<PublicItem> selectDistinctProducts(List<PublicItem> matches) {

        List<PublicItem> result = new ArrayList<>();

        Set<Long> ids = new HashSet<>();



        for (PublicItem item : matches) {

            if (!ids.add(item.productId())) continue;

            result.add(item);

            if (result.size() >= MAX_CARDS) break;

        }



        return result;

    }



    private List<ChatProduct> toChatProducts(List<PublicItem> items) {

        return items.stream().map(this::toChatProduct).toList();

    }



    private ChatProduct toChatProduct(PublicItem item) {

        return new ChatProduct(

                item.productId(),

                item.variantId(),

                item.name(),

                item.price(),

                item.size(),

                item.color(),

                item.stock()

        );

    }



    private String buildIntroduction(SearchRequest request, int count) {

        if (request.minPrice() != null && request.maxPrice() != null) {

            if (request.minPrice().compareTo(request.maxPrice()) == 0) {

                return "Mình tìm được " + count + " mẫu có giá đúng "

                        + formatPrice(request.minPrice()) + ".";

            }

            return "Mình tìm được " + count + " mẫu trong khoảng "

                    + formatPrice(request.minPrice()) + "–"

                    + formatPrice(request.maxPrice()) + ".";

        }



        if (request.maxPrice() != null) {

            return "Mình tìm được " + count + " mẫu có giá không quá "

                    + formatPrice(request.maxPrice()) + ".";

        }



        if (request.minPrice() != null) {

            return "Mình tìm được " + count + " mẫu có giá từ "

                    + formatPrice(request.minPrice()) + " trở lên.";

        }



        return "Mình tìm được " + count + " mẫu phù hợp để bạn tham khảo.";

    }



    private String buildNoResultsMessage(SearchRequest request) {

        if (request.minPrice() != null && request.maxPrice() != null) {

            return "Mình chưa tìm thấy mẫu phù hợp trong khoảng "

                    + formatPrice(request.minPrice()) + "–"

                    + formatPrice(request.maxPrice())

                    + ". Bạn có thể đổi khoảng giá, size hoặc màu nhé.";

        }



        return "Mình chưa tìm thấy sản phẩm khớp yêu cầu. Bạn thử đổi loại sản phẩm, giá, size hoặc màu nhé.";

    }



    private String detectProductType(String text) {

        for (String type : List.of(

                "ao so mi", "ao thun", "ao phong", "ao khoac",

                "ao chong nang", "ao ba lo",

                "quan jean", "quan jeans", "quan short",

                "vay", "dam", "set", "giay", "dep", "tui",

                "ao", "quan"

        )) {

            if (containsPhrase(text, type)) {

                return switch (type) {

                    case "ao phong" -> "ao thun";

                    case "quan jeans" -> "quan jean";

                    default -> type;

                };

            }

        }

        return null;

    }



    private String detectColor(String text) {

        for (String color : List.of(

                "den", "trang", "do", "xanh", "hong",

                "vang", "nau", "xam", "tim", "cam", "be"

        )) {

            if (containsPhrase(text, "mau " + color)

                    || text.equals(color)

                    || containsPhrase(text, color)) {

                return color;

            }

        }

        return null;

    }



    private String detectBrand(String text, Set<String> brands) {

        for (String brand : brands) {

            if (containsPhrase(text, brand)) return brand;

        }

        return null;

    }



    private String detectOccasion(String text) {

        for (String occasion : List.of(

                "di bien", "di choi", "di hoc", "di lam",

                "du tiec", "sinh nhat", "phong van", "hen ho",

                "the thao", "van dong", "tap luyen", "du lich", "mac hang ngay"

        )) {

            if (containsPhrase(text, occasion)) return occasion;

        }

        return null;

    }



    private boolean matchesProductType(PublicItem item, String type) {

        if (type == null || type.isBlank()) return true;



        String name = normalize(item.name());

        String category = normalize(item.category());



        if ("ao thun".equals(normalize(type))) {

            return containsPhrase(name, "ao thun")

                    || containsPhrase(name, "ao phong")

                    || containsPhrase(category, "ao thun");

        }



        return containsPhrase(name, type) || containsPhrase(category, type);

    }



    private boolean matchesAudience(PublicItem item, String audience) {
        if (audience == null || audience.isBlank()) return true;

        String wanted = normalize(audience);
        String category = normalize(item.category());
        String name = normalize(item.name());

        boolean boy = containsPhrase(category, "be trai");
        boolean girl = containsPhrase(category, "be gai");
        boolean child = boy || girl || containsPhrase(category, "tre em");

        boolean men = !child && (containsPhrase(category, "thoi trang nam")
                || containsPhrase(category, "do nam")
                || containsPhrase(category, "nam"));
        boolean women = !child && (containsPhrase(category, "thoi trang nu")
                || containsPhrase(category, "do nu")
                || containsPhrase(category, "nu"));

        boolean femaleType = containsPhrase(name, "vay") || containsPhrase(name, "dam")
                || containsPhrase(category, "vay") || containsPhrase(category, "dam");
        boolean maleName = containsPhrase(name, "nam");
        boolean femaleName = containsPhrase(name, "nu");

        return switch (wanted) {
            case "be trai" -> boy || (child && !girl && containsPhrase(name, "be trai"));
            case "be gai" -> girl || (child && !boy && containsPhrase(name, "be gai"));
            case "tre em" -> child;
            case "nam" -> {
                if (child || women || femaleName || femaleType) yield false;
                yield men || maleName || isGenderNeutralItem(item);
            }
            case "nu" -> {
                if (child || men || maleName) yield false;
                yield women || femaleName || femaleType || isGenderNeutralItem(item);
            }
            default -> true;
        };
    }

    private boolean isGenderNeutralItem(PublicItem item) {
        String category = normalize(item.category());
        String name = normalize(item.name());

        if (containsPhrase(category, "nam") || containsPhrase(category, "nu")
                || containsPhrase(name, "nam") || containsPhrase(name, "nu")) return false;

        if (containsPhrase(name, "vay") || containsPhrase(name, "dam")
                || containsPhrase(category, "vay") || containsPhrase(category, "dam")) return false;

        return containsPhrase(name, "ao") || containsPhrase(name, "quan")
                || containsPhrase(name, "giay") || containsPhrase(name, "dep")
                || containsPhrase(name, "tui") || containsPhrase(category, "ao")
                || containsPhrase(category, "quan") || containsPhrase(category, "giay")
                || containsPhrase(category, "dep") || containsPhrase(category, "tui");
    }



    private Integer referencedIndex(String text) {

        if (containsPhrase(text, "mau dau")

                || containsPhrase(text, "mau dau tien")

                || containsPhrase(text, "mau thu nhat")

                || containsPhrase(text, "cai dau")) return 0;



        if (containsPhrase(text, "mau thu hai")

                || containsPhrase(text, "mau thu 2")

                || containsPhrase(text, "cai thu hai")

                || containsPhrase(text, "cai thu 2")) return 1;



        if (containsPhrase(text, "mau thu ba")

                || containsPhrase(text, "mau thu 3")

                || containsPhrase(text, "cai thu ba")

                || containsPhrase(text, "cai thu 3")) return 2;



        Matcher matcher = Pattern.compile(

                "\\b(?:mau|cai|san pham)\\s*(?:thu|so)?\\s*(\\d+)\\b"

        ).matcher(text);



        if (matcher.find()) {

            int n = Integer.parseInt(matcher.group(1));

            if (n >= 1 && n <= MAX_CARDS) return n - 1;

        }



        return null;

    }



    private boolean looksLikeCompareRequest(String text) {

        return containsPhrase(text, "so sanh")

                || containsPhrase(text, "cai nao re hon")

                || containsPhrase(text, "cai nao dat hon")

                || containsPhrase(text, "cai nao hop hon")

                || containsPhrase(text, "mau nao tot hon");

    }



    private ChatResponse answerComparison(String message, Catalog catalog, ChatContext context) {

        List<Integer> indexes = referencedIndexes(normalize(message));

        List<Long> productIds = new ArrayList<>();



        for (Integer index : indexes) {

            if (index >= 0 && index < context.lastProductIds.size()) {

                Long id = context.lastProductIds.get(index);

                if (!productIds.contains(id)) productIds.add(id);

            }

        }



        if (productIds.size() < 2 && context.focusedProductId != null) {

            productIds.add(context.focusedProductId);

        }



        if (productIds.size() < 2 && context.lastProductIds.size() >= 2

                && (containsPhrase(message, "cai nao") || containsPhrase(message, "mau nao"))) {

            productIds.clear();

            productIds.add(context.lastProductIds.get(0));

            productIds.add(context.lastProductIds.get(1));

        }



        if (productIds.size() < 2) {

            return new ChatResponse(

                    "Bạn muốn so sánh những mẫu nào? Ví dụ: “so sánh mẫu 1 và mẫu 3” nhé.",

                    List.of()

            );

        }



        productIds = productIds.stream().distinct().limit(3).toList();

        List<PublicItem> representatives = new ArrayList<>();

        StringBuilder reply = new StringBuilder("Mình so sánh theo dữ liệu đang có của shop:\n");



        int no = 1;

        for (Long productId : productIds) {

            List<PublicItem> variants = catalog.items().stream()

                    .filter(i -> Objects.equals(i.productId(), productId))

                    .toList();

            if (variants.isEmpty()) continue;



            PublicItem representative = variants.stream()

                    .filter(i -> i.stock() > 0)

                    .min(Comparator.comparing(PublicItem::price))

                    .orElse(variants.get(0));

            representatives.add(representative);



            BigDecimal minPrice = variants.stream().map(PublicItem::price).min(BigDecimal::compareTo).orElse(representative.price());

            BigDecimal maxPrice = variants.stream().map(PublicItem::price).max(BigDecimal::compareTo).orElse(representative.price());

            Set<String> sizes = variants.stream().filter(i -> i.stock() > 0).map(PublicItem::size)

                    .filter(Objects::nonNull).filter(v -> !v.isBlank()).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

            Set<String> colors = variants.stream().filter(i -> i.stock() > 0).map(PublicItem::color)

                    .filter(Objects::nonNull).filter(v -> !v.isBlank()).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

            int stock = variants.stream().mapToInt(PublicItem::stock).sum();



            reply.append("\n").append(no++).append(". ").append(representative.name());

            reply.append("\n• Giá: ").append(formatPrice(minPrice));

            if (minPrice.compareTo(maxPrice) != 0) reply.append(" – ").append(formatPrice(maxPrice));

            reply.append("\n• Size còn hàng: ").append(sizes.isEmpty() ? "chưa có" : String.join(", ", sizes));

            reply.append("\n• Màu còn hàng: ").append(colors.isEmpty() ? "chưa có" : String.join(", ", colors));

            reply.append("\n• Tổng tồn các biến thể: ").append(stock);

        }



        if (representatives.size() >= 2) {

            PublicItem cheapest = representatives.stream().min(Comparator.comparing(PublicItem::price)).orElse(representatives.get(0));

            reply.append("\n\nNếu ưu tiên giá hiện tại, ").append(cheapest.name()).append(" có lựa chọn giá thấp hơn trong các mẫu đang so sánh.");

        }



        context.lastProductIds.clear();

        representatives.forEach(i -> context.lastProductIds.add(i.productId()));

        context.focusedProductId = null;

        return new ChatResponse(reply.toString(), toChatProducts(representatives));

    }



    private List<Integer> referencedIndexes(String text) {

        List<Integer> result = new ArrayList<>();

        Matcher matcher = Pattern.compile("\\b(?:mau|cai|san pham)\\s*(?:thu|so)?\\s*(\\d+)\\b").matcher(text);

        while (matcher.find()) {

            int n = Integer.parseInt(matcher.group(1));

            if (n >= 1 && n <= MAX_CARDS && !result.contains(n - 1)) result.add(n - 1);

        }

        if (containsPhrase(text, "mau dau") || containsPhrase(text, "mau dau tien")) result.add(0);

        return result;

    }



    private boolean looksLikeSimilarRequest(String text) {

        return containsPhrase(text, "tuong tu")

                || containsPhrase(text, "giong")

                || containsPhrase(text, "re hon")

                || containsPhrase(text, "loai khac");

    }



    private ChatResponse answerSimilarProducts(String message, Catalog catalog, ChatContext context) {

        PublicItem base = catalog.items().stream()

                .filter(i -> Objects.equals(i.productId(), context.focusedProductId))

                .findFirst().orElse(null);

        if (base == null) return new ChatResponse("Mình chưa xác định được sản phẩm bạn muốn tìm tương tự.", List.of());



        SearchRequest extra = parseLocally(message, catalog);

        String text = normalize(message);

        List<PublicItem> candidates = catalog.items().stream()

                .filter(i -> !Objects.equals(i.productId(), base.productId()))

                .filter(i -> !containsPhrase(text, "re hon") || i.price().compareTo(base.price()) < 0)

                .filter(i -> extra.color() == null || containsPhrase(i.color(), extra.color()))

                .filter(i -> extra.size() == null || normalize(i.size()).equals(normalize(extra.size())))

                .filter(i -> extra.stockOnly() ? i.stock() > 0 : true)

                .sorted(Comparator.comparingInt((PublicItem i) -> similarityScore(base, i)).reversed()

                        .thenComparing(PublicItem::price))

                .toList();



        List<PublicItem> selected = selectDistinctProducts(candidates);

        if (selected.isEmpty()) {

            return new ChatResponse("Mình chưa tìm thấy mẫu tương tự phù hợp với điều kiện bạn thêm vào.", List.of());

        }

        updateProductContext(context, selected);

        return new ChatResponse("Mình tìm các mẫu gần với “" + base.name() + "” dựa trên loại sản phẩm, danh mục, thương hiệu, màu và mức giá hiện có.", toChatProducts(selected));

    }



    private int similarityScore(PublicItem base, PublicItem other) {

        int score = 0;

        if (normalize(base.category()).equals(normalize(other.category()))) score += 12;

        if (base.brand() != null && other.brand() != null && normalize(base.brand()).equals(normalize(other.brand()))) score += 4;

        if (base.color() != null && other.color() != null && normalize(base.color()).equals(normalize(other.color()))) score += 3;

        if (other.stock() > 0) score += 3;

        BigDecimal distance = base.price().subtract(other.price()).abs();

        if (distance.compareTo(new BigDecimal("100000")) <= 0) score += 3;

        return score;

    }



    private boolean looksLikeOutfitRequest(String text) {

        return containsPhrase(text, "phoi do")

                || containsPhrase(text, "phoi cho")

                || containsPhrase(text, "outfit")

                || containsPhrase(text, "mot bo")

                || containsPhrase(text, "set do")

                || containsPhrase(text, "mac gi")

                || containsPhrase(text, "nen mac gi");

    }



    private ChatResponse answerOutfit(String message, Catalog catalog, ChatContext context) {

        SearchRequest request = parseLocally(message, catalog);

        BigDecimal budget = extractBudget(normalize(message));

        String audience = request.audience();

        String occasion = request.occasion();



        List<PublicItem> pool = catalog.items().stream()

                .filter(i -> i.stock() > 0)

                .filter(i -> matchesAudience(i, audience))

                .filter(i -> request.color() == null || containsPhrase(i.color(), request.color()))

                .sorted(Comparator.comparing(PublicItem::price))

                .toList();



        List<PublicItem> distinct = selectBestVariantPerProduct(pool);

        List<PublicItem> tops = distinct.stream().filter(i -> isTop(i)).toList();

        List<PublicItem> bottoms = distinct.stream().filter(i -> isBottom(i)).toList();

        List<PublicItem> shoes = distinct.stream().filter(i -> isShoes(i)).toList();



        List<PublicItem> outfit = new ArrayList<>();

        PublicItem top = firstWithin(tops, budget, BigDecimal.ZERO);

        if (top != null) outfit.add(top);

        BigDecimal total = sumPrices(outfit);

        PublicItem bottom = firstWithin(bottoms, budget, total);

        if (bottom != null) outfit.add(bottom);

        total = sumPrices(outfit);

        PublicItem shoe = firstWithin(shoes, budget, total);

        if (shoe != null) outfit.add(shoe);



        if (outfit.size() < 2) {

            outfit.clear();

            for (PublicItem item : distinct) {

                if (outfit.stream().anyMatch(x -> Objects.equals(x.productId(), item.productId()))) continue;

                BigDecimal next = sumPrices(outfit).add(item.price());

                if (budget == null || next.compareTo(budget) <= 0) outfit.add(item);

                if (outfit.size() >= 3) break;

            }

        }



        if (outfit.isEmpty()) {
            List<PublicItem> affordable = distinct.stream()
                    .filter(i -> budget == null || i.price().compareTo(budget) <= 0)
                    .limit(MAX_CARDS)
                    .toList();

            if (!affordable.isEmpty()) {
                updateProductContext(context, affordable);
                String msg = budget == null
                        ? "Hiện mình chưa ghép được một outfit hoàn chỉnh, nhưng mình tìm được một số món còn hàng để bạn chọn trước."
                        : "Với ngân sách " + formatPrice(budget)
                        + ", hiện mình chưa ghép được một outfit hoàn chỉnh phù hợp. "
                        + "Mình tìm được các món riêng lẻ trong ngân sách để bạn tham khảo; bạn cũng có thể tăng ngân sách để mình phối cả set.";
                return new ChatResponse(msg, toChatProducts(affordable));
            }

            return new ChatResponse(
                    budget == null
                            ? "Hiện mình chưa ghép được outfit phù hợp từ các sản phẩm còn hàng. Bạn thử đổi yêu cầu nhé."
                            : "Với ngân sách " + formatPrice(budget)
                            + ", hiện chưa có món phù hợp để ghép outfit. Bạn có thể tăng ngân sách hoặc đổi yêu cầu nhé.",
                    List.of()
            );
        }

        if (outfit.size() == 1) {
            updateProductContext(context, outfit);
            String msg = "Với ngân sách "
                    + (budget == null ? "hiện tại" : formatPrice(budget))
                    + ", mình mới chọn được 1 món phù hợp nên chưa thể gọi là một outfit hoàn chỉnh. "
                    + "Bạn có thể chọn món này trước hoặc tăng ngân sách để mình phối thêm.";
            return new ChatResponse(msg, toChatProducts(outfit));
        }

        total = sumPrices(outfit);

        StringBuilder reply = new StringBuilder("Mình gợi ý một outfit từ các sản phẩm đang còn hàng");

        if (audience != null) reply.append(" cho ").append(audience);

        if (occasion != null) reply.append(" để ").append(occasion);

        reply.append(":\n");

        for (int i = 0; i < outfit.size(); i++) {

            PublicItem item = outfit.get(i);

            reply.append("\n").append(i + 1).append(". ").append(item.name()).append(" — ").append(formatPrice(item.price()));

        }

        reply.append("\n\nTổng: ").append(formatPrice(total));

        if (budget != null) reply.append(" / ngân sách ").append(formatPrice(budget));

        reply.append(". Bạn có thể nói “mẫu 1 còn size L không?” hoặc “tìm mẫu tương tự rẻ hơn”.");



        updateProductContext(context, outfit);

        context.lastOutfitProductIds.clear();

        outfit.forEach(i -> context.lastOutfitProductIds.add(i.productId()));

        return new ChatResponse(reply.toString(), toChatProducts(outfit));

    }



    private List<PublicItem> selectBestVariantPerProduct(List<PublicItem> items) {

        Map<Long, PublicItem> best = new LinkedHashMap<>();

        for (PublicItem item : items) {

            PublicItem old = best.get(item.productId());

            if (old == null || (old.stock() <= 0 && item.stock() > 0) || item.price().compareTo(old.price()) < 0) {

                best.put(item.productId(), item);

            }

        }

        return new ArrayList<>(best.values());

    }



    private boolean isTop(PublicItem i) {

        String t = normalize(i.name() + " " + i.category());

        return containsPhrase(t, "ao") || containsPhrase(t, "shirt") || containsPhrase(t, "top");

    }



    private boolean isBottom(PublicItem i) {

        String t = normalize(i.name() + " " + i.category());

        return containsPhrase(t, "quan") || containsPhrase(t, "vay") || containsPhrase(t, "skirt");

    }



    private boolean isShoes(PublicItem i) {

        String t = normalize(i.name() + " " + i.category());

        return containsPhrase(t, "giay") || containsPhrase(t, "dep") || containsPhrase(t, "sandal");

    }



    private PublicItem firstWithin(List<PublicItem> items, BigDecimal budget, BigDecimal current) {

        for (PublicItem item : items) {

            if (budget == null || current.add(item.price()).compareTo(budget) <= 0) return item;

        }

        return null;

    }



    private BigDecimal sumPrices(List<PublicItem> items) {

        return items.stream().map(PublicItem::price).reduce(BigDecimal.ZERO, BigDecimal::add);

    }



    private BigDecimal extractBudget(String text) {

        if (!(containsPhrase(text, "ngan sach") || containsPhrase(text, "budget")

                || containsPhrase(text, "co khoang") || containsPhrase(text, "co tam")

                || containsPhrase(text, "toi co") || containsPhrase(text, "minh co")

                || looksLikeOutfitRequest(text))) return null;

        List<BigDecimal> prices = extractPrices(text);

        return prices.isEmpty() ? null : prices.get(0);

    }



    private boolean looksLikeSizeAdvice(String text) {

        boolean hasHeight = Pattern.compile("\\b1[.,]?[3-9]\\d?\\s*(?:m|cm)?\\b").matcher(text).find()

                || containsPhrase(text, "cao");

        boolean hasWeight = Pattern.compile("\\b\\d{2,3}\\s*(?:kg|can)\\b").matcher(text).find()

                || containsPhrase(text, "nang");

        return (hasHeight && hasWeight) && (containsPhrase(text, "size") || containsPhrase(text, "mac"));

    }



    private ChatResponse answerSizeAdvice(String message, Catalog catalog, ChatContext context) {

        List<String> availableSizes = catalog.items().stream().filter(i -> i.stock() > 0)

                .map(PublicItem::size).filter(Objects::nonNull).filter(v -> !v.isBlank())

                .distinct().limit(12).toList();

        return new ChatResponse(

                "Shop hiện chưa có bảng size theo chiều cao/cân nặng trong dữ liệu chatbot nên mình không muốn đoán size chính xác. "

                        + "Các size đang xuất hiện ở sản phẩm còn hàng gồm: "

                        + (availableSizes.isEmpty() ? "chưa có dữ liệu size" : String.join(", ", availableSizes))

                        + ". Bạn hãy chọn một mẫu cụ thể, mình sẽ kiểm tra chính xác các size còn hàng của mẫu đó.",

                List.of()

        );

    }



    private boolean looksLikeGeneralFashionAdvice(String text) {
        return containsPhrase(text, "tu van")
                || containsPhrase(text, "phu hop")
                || containsPhrase(text, "hop de")
                || containsPhrase(text, "nen chon")
                || containsPhrase(text, "goi y")
                || containsPhrase(text, "hop mau gi")
                || containsPhrase(text, "phoi mau")
                || containsPhrase(text, "phong cach")
                || containsPhrase(text, "basic")
                || containsPhrase(text, "lich su")
                || containsPhrase(text, "tre trung")
                || containsPhrase(text, "nang dong")
                || containsPhrase(text, "van dong")
                || containsPhrase(text, "the thao")
                || containsPhrase(text, "mac hang ngay")
                || containsPhrase(text, "di bien")
                || containsPhrase(text, "di choi")
                || containsPhrase(text, "di hoc")
                || containsPhrase(text, "di lam")
                || containsPhrase(text, "du tiec")
                || containsPhrase(text, "sinh nhat")
                || containsPhrase(text, "phong van")
                || containsPhrase(text, "hen ho")
                || containsPhrase(text, "du lich");
    }



    private ChatResponse answerGeneralFashionAdvice(String message, Catalog catalog, ChatContext context) {
        SearchRequest request = parseLocally(message, catalog);

        List<PublicItem> candidates = findMatches(catalog.items(), request, context).stream()
                .filter(i -> i.stock() > 0)
                .toList();

        List<PublicItem> selected = selectDistinctProducts(candidates);

        // Hard constraints: không phá giới tính/giá/màu khách đã yêu cầu chỉ để có kết quả.
        if (selected.isEmpty()) {
            StringBuilder msg = new StringBuilder("Hiện mình chưa tìm thấy sản phẩm còn hàng phù hợp");
            if (request.audience() != null) msg.append(" cho ").append(audienceLabel(request.audience()));
            if (request.occasion() != null) msg.append(" với nhu cầu ").append(request.occasion());
            msg.append(". Bạn có thể đổi ngân sách, màu, loại sản phẩm hoặc để mình gợi ý theo tiêu chí rộng hơn.");
            return new ChatResponse(msg.toString(), List.of());
        }

        String advice = askFashionAdviceSafely(message, selected);

        if (advice == null || advice.isBlank()) {
            StringBuilder msg = new StringBuilder("Mình đã lọc các sản phẩm còn hàng");
            if (request.audience() != null) msg.append(" đúng nhóm ").append(audienceLabel(request.audience()));
            if (request.occasion() != null) msg.append(" và ưu tiên các mẫu phù hợp với ").append(request.occasion());
            msg.append(". Các mẫu dưới đây được xếp theo mức độ phù hợp từ tên, danh mục và mô tả hiện có. Bạn có thể chọn một mẫu để mình kiểm tra tiếp size, màu hoặc giá.");
            advice = msg.toString();
        }

        updateProductContext(context, selected);
        return new ChatResponse(advice, toChatProducts(selected));
    }

    private String audienceLabel(String audience) {
        if (audience == null) return "";
        return switch (normalize(audience)) {
            case "nam" -> "nam";
            case "nu" -> "nữ";
            case "be trai" -> "bé trai";
            case "be gai" -> "bé gái";
            case "tre em" -> "trẻ em";
            default -> audience;
        };
    }



    private String askFashionAdviceSafely(String message, List<PublicItem> selected) {

        if (!groqAvailable()) return "";

        try {

            String productJson = objectMapper.writeValueAsString(selected.stream().limit(MAX_AI_ITEMS).toList());

            String prompt = """

                    Bạn là AI Stylist của shop thời trang JODOK.

                    Hãy trả lời câu hỏi tư vấn thời trang của khách bằng tiếng Việt, ngắn gọn, thân thiện, tối đa 4 câu.



                    Quy tắc:

                    - Có thể dùng kiến thức phối đồ phổ thông để tư vấn màu/phong cách/dịp sử dụng.
                    - Nếu khách hỏi sản phẩm phù hợp với một hoạt động/dịp, hãy giải thích ngắn gọn tiêu chí lựa chọn.
                    - Chỉ khẳng định sản phẩm cụ thể phù hợp khi name/category/description đủ căn cứ; nếu chưa đủ, nói đó là lựa chọn tham khảo.
                    - Với vận động/thể thao, không tự khẳng định co giãn, thấm hút hoặc thoáng khí nếu dữ liệu không nêu.

                    - Khi nhắc tới sản phẩm của JODOK, CHỈ được dùng sản phẩm trong dữ liệu cung cấp.
                    - Nếu khách yêu cầu nam/nữ/trẻ em, tuyệt đối không đổi sang nhóm đối tượng khác.
                    - Không được giới thiệu váy/đầm cho yêu cầu nam.
                    - Nếu dữ liệu chưa đủ để khẳng định phù hợp, hãy nói đó là gợi ý tham khảo.

                    - Tuyệt đối không tự tạo giá, size, màu, tồn kho, thương hiệu, chất liệu hoặc chính sách.

                    - Không suy đoán đặc điểm cơ thể/ngoại hình mà khách chưa nói.

                    - Nếu dữ liệu chưa đủ để kết luận size thì phải nói rõ cần size chart hoặc mẫu cụ thể.

                    - Không nói rằng một sản phẩm có chất liệu/công dụng nào nếu description không nêu.

                    - Trả JSON duy nhất: {"reply":"..."}



                    SẢN PHẨM ĐÃ XÁC MINH:

                    """ + productJson + """



                    KHÁCH HỎI:

                    """ + message;

            JsonNode result = callGroqJson(prompt);

            return result == null ? "" : result.path("reply").asText("").trim();

        } catch (RestClientResponseException ex) {

            handleGroqHttpError(ex);

            return "";

        } catch (Exception ex) {

            System.err.println("Groq fashion advisor error: " + ex.getClass().getSimpleName());

            return "";

        }

    }



    // V9.1 - mọi danh sách card gửi ra UI phải trở thành reference memory mới.
    private void syncDisplayedProducts(ChatContext context, List<PublicItem> items) {
        context.lastProductIds.clear();
        if (items != null) {
            for (PublicItem item : items) {
                if (item == null || item.productId() == null) continue;
                if (!context.lastProductIds.contains(item.productId())) {
                    context.lastProductIds.add(item.productId());
                }
                if (context.lastProductIds.size() >= MAX_CARDS) break;
            }
        }
        context.focusedProductId = context.lastProductIds.size() == 1
                ? context.lastProductIds.get(0)
                : null;
        context.updatedAt = System.currentTimeMillis();
    }

    private void clearProductContext(ChatContext context) {
        context.lastProductIds.clear();
        context.lastOutfitProductIds.clear();
        context.focusedProductId = null;
        context.updatedAt = System.currentTimeMillis();
    }

    private void updateProductContext(ChatContext context, List<PublicItem> items) {
        syncDisplayedProducts(context, items);
        // Search/compare nhiều card không tự focus một sản phẩm.
        if (items != null && items.size() != 1) context.focusedProductId = null;
    }



    private boolean looksLikeVariantFollowUp(String text) {

        return containsPhrase(text, "size")

                || containsPhrase(text, "mau")

                || detectColor(text) != null

                || containsPhrase(text, "con hang")

                || containsPhrase(text, "het hang")

                || containsPhrase(text, "con khong");

    }



    private boolean isFollowUp(String text) {

        return containsPhrase(text, "re hon")

                || containsPhrase(text, "dat hon")

                || containsPhrase(text, "con size")

                || containsPhrase(text, "co size")

                || containsPhrase(text, "mau khac")

                || containsPhrase(text, "con mau")

                || containsPhrase(text, "loai khac")

                || containsPhrase(text, "thi sao");

    }



    private boolean isGreeting(String text) {

        return text.equals("xin chao")

                || text.equals("chao")

                || text.equals("hello")

                || text.equals("hi");

    }



    private boolean asksAboutCategories(String text) {

        return containsPhrase(text, "danh muc")

                || containsPhrase(text, "loai san pham")

                || containsPhrase(text, "shop ban nhung gi");

    }



    private boolean asksAboutBrands(String text) {

        return containsPhrase(text, "thuong hieu nao")

                || containsPhrase(text, "cac thuong hieu")

                || containsPhrase(text, "hang nao");

    }



    private BigDecimal decimalOrNull(JsonNode node) {

        if (node == null || node.isNull() || !node.isNumber()) return null;

        return node.decimalValue();

    }



    private String cleanNullable(String value) {

        if (value == null) return null;

        String s = value.trim();

        if (s.isBlank() || "null".equalsIgnoreCase(s)) return null;

        return s;

    }



    private void cleanupContexts() {

        long now = System.currentTimeMillis();

        contexts.entrySet().removeIf(e -> now - e.getValue().updatedAt > CONTEXT_TTL_MS);

    }



    private boolean isActive(String status) {

        return "ACTIVE".equalsIgnoreCase(status);

    }



    private boolean isPublicCategory(Category category) {

        if (category == null) return false;



        Category current = category;

        int level = 0;



        while (current != null && level < 10) {

            if (!isActive(current.getStatus())) return false;

            current = current.getParent();

            level++;

        }



        return current == null;

    }



    private String getCategoryPath(Category category) {

        List<String> names = new ArrayList<>();

        Category current = category;

        int level = 0;



        while (current != null && level < 10) {

            if (current.getCategoryName() != null) {

                names.add(0, current.getCategoryName());

            }

            current = current.getParent();

            level++;

        }



        return String.join(" > ", names);

    }



    private String getPublicBrandName(Brand brand) {

        if (brand == null || !isActive(brand.getStatus())) return null;

        return brand.getBrandName();

    }



    private boolean containsPhrase(String text, String phrase) {

        return (" " + normalize(text) + " ")

                .contains(" " + normalize(phrase) + " ");

    }



    private String safe(String value) {
        return value == null ? "" : value;
    }



    private String normalize(String value) {

        if (value == null) return "";



        String result = Normalizer.normalize(

                value.toLowerCase(Locale.ROOT),

                Normalizer.Form.NFD

        );



        return result

                .replaceAll("\\p{M}", "")

                .replace('đ', 'd')

                .replaceAll("[^a-z0-9]+", " ")

                .replaceAll("\\s+", " ")

                .trim();

    }



    private String formatPrice(BigDecimal price) {

        return String.format(

                Locale.forLanguageTag("vi-VN"),

                "%,.0fđ",

                price

        );

    }

}
