package com.dacs.fashion.ai.groq;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class GroqClientTest {
    private final GroqClient client = new GroqClient(new ObjectMapper());

    @Test void acceptsPlainFencedAndWrappedJsonWithoutUsingModelTextAsHtml() {
        for (String content : new String[] {
                "{\"action\":\"PRODUCT_SEARCH\"}",
                "```json\n{\"action\":\"PRODUCT_SEARCH\"}\n```",
                "Kế hoạch:\n{\"action\":\"PRODUCT_SEARCH\"}"
        }) {
            JsonNode result = ReflectionTestUtils.invokeMethod(client, "parseJsonSafely", content);
            assertNotNull(result);
            assertEquals("PRODUCT_SEARCH", result.path("action").asText());
        }
    }

    @Test void rejectsInvalidJsonAndMissingOrTruncatedProviderChoices() {
        assertThrows(Exception.class, () -> ReflectionTestUtils.invokeMethod(client, "parseJsonSafely", "{broken"));
        assertNull(ReflectionTestUtils.invokeMethod(client, "parseResponse", ""));
        assertNull(ReflectionTestUtils.invokeMethod(client, "parseResponse", "{\"choices\":[]}"));
        assertNull(ReflectionTestUtils.invokeMethod(client, "parseResponse",
                "{\"choices\":[{\"finish_reason\":\"length\",\"message\":{\"content\":\"{}\"}}]}"));
    }

    @Test void missingKeyFailsLocallyWithoutCallingProvider() {
        assertFalse(client.isAvailable());
        assertThrows(IllegalStateException.class, () -> client.callJson("Xin chào"));
    }
}

