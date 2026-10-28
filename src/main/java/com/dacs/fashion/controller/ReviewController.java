package com.dacs.fashion.controller;

import com.dacs.fashion.entity.Review;
import com.dacs.fashion.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import com.dacs.fashion.entity.User;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @GetMapping
    public List<Review> getAll() {
        return reviewService.getAll();
    }

    @GetMapping("/product/{productId}")
    public List<Review> getByProductId(@PathVariable Long productId) {
        return reviewService.getByProductId(productId);
    }

    @GetMapping("/{id}")
    public Review getById(@PathVariable Long id) {
        return reviewService.getById(id);
    }

    @GetMapping("/user/{userId}")
    public List<Review> getByUser(@PathVariable Long userId) {
        return reviewService.getByUser(userId);
    }

    @PostMapping
    public Review create(@RequestBody Map<String, Object> body, Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();
        Long userId = currentUser.getUserId();
        Long orderItemId = Long.valueOf(body.get("orderItemId").toString());
        Integer rating = Integer.valueOf(body.get("rating").toString());
        String comment = body.get("comment").toString();
        String imageUrl = body.get("imageUrl") == null ? null : body.get("imageUrl").toString();

        return reviewService.create(userId, orderItemId, rating, comment, imageUrl);
    }

    @DeleteMapping("/{id}")
    public String delete(@PathVariable Long id) {
        reviewService.delete(id);
        return "Xóa đánh giá thành công";
    }
}