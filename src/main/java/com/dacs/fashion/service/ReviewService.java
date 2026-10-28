package com.dacs.fashion.service;

import com.dacs.fashion.entity.OrderItem;
import com.dacs.fashion.entity.Review;
import com.dacs.fashion.entity.User;
import com.dacs.fashion.repository.OrderItemRepository;
import com.dacs.fashion.repository.ReviewRepository;
import com.dacs.fashion.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final OrderItemRepository orderItemRepository;

    public List<Review> getAll() {
        return reviewRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public List<Review> getByProductId(Long productId) {
        return reviewRepository.findByProductId(productId);
    }

    public List<Review> getByUser(Long userId) {
        return reviewRepository.findByUser_UserIdOrderByCreatedAtDesc(userId);
    }

    public Review getById(Long id) {
        return reviewRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đánh giá"));
    }

    @Transactional
    public Review create(
            Long userId,
            Long orderItemId,
            Integer rating,
            String comment,
            String imageUrl
    ) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy user"));

        OrderItem orderItem = orderItemRepository.findById(orderItemId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy order item"));

        if (rating == null || rating < 1 || rating > 5) {
            throw new RuntimeException("Số sao phải từ 1 đến 5");
        }

        if (comment == null || comment.isBlank()) {
            throw new RuntimeException("Nội dung đánh giá không được để trống");
        }

        if (!orderItem.getOrder().getUser().getUserId().equals(userId)) {
            throw new RuntimeException("Bạn không có quyền đánh giá sản phẩm này");
        }

        if (!"COMPLETED".equals(orderItem.getOrder().getOrderStatus())) {
            throw new RuntimeException("Chỉ được đánh giá đơn hàng đã hoàn thành");
        }

        boolean exists =
                reviewRepository.existsByOrderItem_OrderItemId(orderItemId);

        if (exists) {
            throw new RuntimeException("Sản phẩm này đã được đánh giá");
        }

        Review review = new Review();

        review.setUser(user);
        review.setOrderItem(orderItem);
        review.setRating(rating);
        review.setComment(comment);
        review.setImageUrl(imageUrl);
        review.setCreatedAt(LocalDateTime.now());

        return reviewRepository.save(review);
    }

    @Transactional
    public void delete(Long id) {

        Review review = reviewRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Không tìm thấy đánh giá")
                );

        reviewRepository.delete(review);
    }
}