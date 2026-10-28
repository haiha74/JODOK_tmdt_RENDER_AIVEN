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
        List<ProductView> views = productViewRepository.findByUser_UserId(userId);

        if (views.isEmpty()) {
            return List.of();
        }

        Map<Long, Integer> categoryScore = new HashMap<>();

        for (ProductView v : views) {
            if (v.getProduct() != null && v.getProduct().getCategory() != null) {
                Long categoryId = v.getProduct().getCategory().getCategoryId();
                categoryScore.put(categoryId, categoryScore.getOrDefault(categoryId, 0) + 1);
            }
        }

        Long topCategoryId = categoryScore.entrySet()
                .stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);

        if (topCategoryId == null) {
            return List.of();
        }

        return productRepository.findAll()
                .stream()
                .filter(p -> p.getStatus() != null && p.getStatus().equals("ACTIVE"))
                .filter(p -> p.getCategory() != null)
                .filter(p -> p.getCategory().getCategoryId().equals(topCategoryId))
                .limit(10)
                .toList();
    }
}