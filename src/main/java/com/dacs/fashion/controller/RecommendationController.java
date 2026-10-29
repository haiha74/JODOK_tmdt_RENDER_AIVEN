package com.dacs.fashion.controller;

import com.dacs.fashion.entity.*;
import com.dacs.fashion.repository.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    private final ProductViewRepository productViewRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public RecommendationController(
            ProductViewRepository productViewRepository,
            ProductRepository productRepository,
            UserRepository userRepository
    ) {
        this.productViewRepository = productViewRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    @PostMapping("/view")
    public ProductView saveView(@RequestBody Map<String, Long> body, Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();
        Long userId = currentUser.getUserId();
        Long productId = body.get("productId");

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy user"));

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy sản phẩm"));

        ProductView view = new ProductView();
        view.setUser(user);
        view.setProduct(product);
        view.setViewedAt(LocalDateTime.now());

        return productViewRepository.save(view);
    }

    @GetMapping("/{userId}")
    public List<Product> recommend(@PathVariable Long userId, Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();

        if (!currentUser.getUserId().equals(userId)) {
            return List.of();
        }
        // Aggregate view counts in MySQL instead of fetching every historical view.
        List<Object[]> counts = productViewRepository.findCategoryViewCounts(userId);
        if (counts.isEmpty() || counts.get(0)[0] == null) {
            return List.of();
        }
        Long categoryId = ((Number) counts.get(0)[0]).longValue();
        // Keep the original behaviour: only ACTIVE products from top category, max 10.
        return productRepository.findTop10ByStatusAndCategory_CategoryIdOrderByProductIdAsc("ACTIVE", categoryId);
    }
}