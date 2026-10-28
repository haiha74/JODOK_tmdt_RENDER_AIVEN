package com.dacs.fashion.ai.groq;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Client duy nhất phụ trách giao tiếp với Groq.
 *
 * Giai đoạn 1:
 * - Chưa thay đổi ChatbotService đang chạy.
 * - File này có thể thêm vào project và compile độc lập.
 * - Các ProductTool/CartTool/JodokAgent sau này sẽ dùng class này.
 */
@Component
public class GroqClient {

    private static final String CHAT_COMPLETIONS_URL =
            "https://api.groq.com/openai/v1/chat/completions";

    private static final String DEFAULT_SYSTEM_PROMPT =
            "Bạn là trợ lý mua sắm JODOK. "
                    + "Luôn trả về đúng một JSON object hợp lệ theo schema được yêu cầu.";

    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    @Value("${GROQ_API_KEY:}")
    private String apiKey;

    @Value("${jodok.ai.groq.model:openai/gpt-oss-20b}")
    private String model;

    private volatile long pauseUntil = 0L;

    public GroqClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .requestFactory(requestFactory())
                .build();
    }

    /**
     * Gọi Groq và yêu cầu JSON object.
     */
    public JsonNode callJson(String prompt) throws Exception {
        return callJson(DEFAULT_SYSTEM_PROMPT, prompt, 700);
    }

    /**
     * Gọi Groq với system prompt riêng.
     */
    public JsonNode callJson(
            String systemPrompt,
            String prompt
    ) throws Exception {
        return callJson(systemPrompt, prompt, 700);
    }

    /**
     * Hàm tổng quát dùng cho các tool/agent sau này.
     */
    public JsonNode callJson(
            String systemPrompt,
            String prompt,
            int maxCompletionTokens
    ) throws Exception {

        if (!isAvailable()) {
            throw new IllegalStateException(
                    "Groq hiện chưa sẵn sàng hoặc chưa cấu hình GROQ_API_KEY."
            );
        }

        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("Prompt không được để trống.");
        }

        String effectiveSystemPrompt =
                systemPrompt == null || systemPrompt.isBlank()
                        ? DEFAULT_SYSTEM_PROMPT
                        : systemPrompt.trim();

        int safeMaxTokens = Math.max(
                100,
                Math.min(maxCompletionTokens, 4000)
        );

        Map<String, Object> body = new LinkedHashMap<>();

        body.put("model", model);

        body.put(
                "messages",
                List.of(
                        Map.of(
                                "role", "system",
                                "content", effectiveSystemPrompt
                        ),
                        Map.of(
                                "role", "user",
                                "content", prompt
                        )
                )
        );

        body.put("temperature", 0.1);
        body.put("max_completion_tokens", safeMaxTokens);
        body.put("reasoning_effort", "low");
        body.put(
                "response_format",
                Map.of("type", "json_object")
        );

        System.out.println(
                "[JODOK][GROQ] model="
                        + model
                        + " promptChars="
                        + prompt.length()
        );

        try {

            String response = restClient
                    .post()
                    .uri(CHAT_COMPLETIONS_URL)
                    .header(
                            "Authorization",
                            "Bearer " + apiKey.trim()
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            return parseResponse(response);

        } catch (RestClientResponseException ex) {

            handleHttpError(ex);

            throw ex;
        }
    }

    /**
     * Dùng cho JodokAgent để biết có thể gọi AI hay không.
     */
    public boolean isAvailable() {
        return apiKey != null
                && !apiKey.isBlank()
                && System.currentTimeMillis() >= pauseUntil;
    }

    public String getModel() {
        return model;
    }

    private JsonNode parseResponse(String response) throws Exception {

        if (response == null || response.isBlank()) {
            return null;
        }

        JsonNode root = objectMapper.readTree(response);

        JsonNode choice = root
                .path("choices")
                .path(0);

        if (choice.isMissingNode() || choice.isNull()) {
            System.err.println(
                    "[JODOK][GROQ] Response không có choices[0]."
            );
            return null;
        }

        String finishReason =
                choice.path("finish_reason").asText("");

        if ("length".equalsIgnoreCase(finishReason)) {
            System.err.println(
                    "[JODOK][GROQ] Response bị cắt do giới hạn output token."
            );
            return null;
        }

        String content = choice
                .path("message")
                .path("content")
                .asText("")
                .trim();

        if (content.isBlank()) {
            System.err.println(
                    "[JODOK][GROQ] message.content rỗng."
            );
            return null;
        }

        return parseJsonSafely(content);
    }

    private JsonNode parseJsonSafely(String raw) throws Exception {

        if (raw == null || raw.isBlank()) {
            return null;
        }

        String cleaned = raw
                .trim()
                .replaceFirst("^```(?:json)?\\s*", "")
                .replaceFirst("\\s*```$", "")
                .trim();

        try {
            return objectMapper.readTree(cleaned);
        } catch (Exception firstError) {

            int start = cleaned.indexOf('{');
            int end = cleaned.lastIndexOf('}');

            if (start >= 0 && end > start) {
                String jsonObject =
                        cleaned.substring(start, end + 1);

                return objectMapper.readTree(jsonObject);
            }

            throw firstError;
        }
    }

    private void handleHttpError(
            RestClientResponseException ex
    ) {

        int status = ex.getStatusCode().value();

        if (status == 429) {

            long cooldownMs = 60_000L;

            try {

                String retryAfter =
                        ex.getResponseHeaders() == null
                                ? null
                                : ex.getResponseHeaders()
                                .getFirst("Retry-After");

                if (
                        retryAfter != null
                                && !retryAfter.isBlank()
                ) {

                    long seconds =
                            Long.parseLong(
                                    retryAfter.trim()
                            );

                    cooldownMs = Math.max(
                            cooldownMs,
                            seconds * 1000L
                    );
                }

            } catch (Exception ignored) {
            }

            pauseUntil =
                    System.currentTimeMillis()
                            + cooldownMs;

            System.err.println(
                    "[JODOK][GROQ][429] Tạm ngưng gọi AI khoảng "
                            + (cooldownMs / 1000L)
                            + " giây."
            );

            return;
        }

        if (status == 401 || status == 403) {

            System.err.println(
                    "[JODOK][GROQ][AUTH] Kiểm tra GROQ_API_KEY. HTTP "
                            + status
            );

            return;
        }

        // Provider response bodies may echo request data. Log only the HTTP status.
        System.err.println("[JODOK][GROQ][HTTP] status=" + status);
    }

    private static SimpleClientHttpRequestFactory requestFactory() {

        SimpleClientHttpRequestFactory factory =
                new SimpleClientHttpRequestFactory();

        factory.setConnectTimeout(
                Duration.ofSeconds(5)
        );

        factory.setReadTimeout(
                Duration.ofSeconds(15)
        );

        return factory;
    }
}
