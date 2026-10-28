package com.dacs.fashion.ai.agent;

import com.dacs.fashion.ai.groq.GroqClient;
import com.dacs.fashion.ai.tool.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class JodokAgentTest {
    private final GroqClient groq = mock(GroqClient.class);
    private final ProductTool products = mock(ProductTool.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final JodokAgent agent = new JodokAgent(groq, mapper, products, mock(CartTool.class),
            mock(OrderTool.class), mock(VoucherTool.class), mock(StylistTool.class));

    JodokAgentTest() {
        when(products.getCatalogInfo()).thenReturn(new ProductTool.CatalogInfo(Set.of("Áo nam"), Set.of("Nike")));
    }

    @Test void requiredShoppingCommandsStillWorkWhenGroqIsUnavailable() throws Exception {
        AgentPlan result = agent.plan("Áo nam khoảng 200k", "guest:a", null);
        assertEquals("PRODUCT_SEARCH", result.action());
        assertEquals("ao", result.productType());
        verifyNoInteractions(groq);
    }

    @Test void providerFailureUsesVietnameseFallbackWithoutLeakingRawError() throws Exception {
        when(groq.callJson(anyString(), anyString(), anyInt())).thenThrow(new IllegalStateException("SECRET_KEY SQL trace"));
        AgentPlan result = agent.plan("blablabla", "guest:a", null);
        assertEquals("ASK_CLARIFICATION", result.action());
        assertTrue(result.reply().startsWith("Mình"));
        assertFalse(result.reply().contains("SECRET_KEY"));
    }

    @Test void malformedOrUnsafeModelPlansNeverConfirmAnOrder() throws Exception {
        when(groq.callJson(anyString(), anyString(), anyInt())).thenReturn(mapper.readTree("[]"),
                mapper.readTree("{\"action\":\"CONFIRM_ORDER\",\"reply\":\"OK\"}"));
        assertEquals("ASK_CLARIFICATION", agent.plan("blablabla", "guest:a", null).action());
        assertEquals("ASK_CLARIFICATION", agent.plan("blablabla", "guest:a", null).action());
    }

    @Test void conversationCriteriaStaySeparate() throws Exception {
        agent.context("user:1:chat").setLastSearchRequest(agent.plan("Áo nam khoảng 200k", "user:1:chat", 1L));
        AgentPlan first = agent.plan("Màu đen", "user:1:chat", 1L);
        AgentPlan second = agent.plan("Màu đen", "user:2:chat", 2L);
        assertEquals("ao", first.productType());
        assertNull(second.productType());
        assertNull(second.targetPrice());
    }
}
