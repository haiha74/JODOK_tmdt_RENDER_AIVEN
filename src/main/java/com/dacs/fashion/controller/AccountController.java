package com.dacs.fashion.controller;
import com.dacs.fashion.entity.User;
import com.dacs.fashion.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {
    private final UserRepository userRepository;

    public record ProfileRequest(
            String fullname,
            String phone,
            String address
    ) {}

    public record ProfileResponse(
            Long userId,
            String fullname,
            String email,
            String phone,
            String address
    ) {}

    private ProfileResponse toResponse(User user) {
        return new ProfileResponse(
                user.getUserId(),
                user.getFullname(),
                user.getEmail(),
                user.getPhone(),
                user.getAddress()
        );
    }

    @GetMapping("/me")
    public ResponseEntity<?> getProfile(
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "Vui lòng đăng nhập"));
        }

        User user = userRepository.findById(currentUser.getUserId())
                .orElse(null);

        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(toResponse(user));
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateProfile(
            @AuthenticationPrincipal User currentUser,
            @RequestBody ProfileRequest dto
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "Vui lòng đăng nhập"));
        }

        User user = userRepository.findById(currentUser.getUserId())
                .orElse(null);

        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        String fullname = dto.fullname() == null
                ? "" : dto.fullname().trim();

        String phone = dto.phone() == null
                ? "" : dto.phone().trim();

        String address = dto.address() == null
                ? "" : dto.address().trim();

        if (fullname.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Vui lòng nhập họ tên"));
        }

        if (!phone.isBlank()
                && !phone.matches("0[0-9]{9}")) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Số điện thoại không hợp lệ"));
        }

        if (fullname.length() > 255
                || phone.length() > 20
                || address.length() > 255) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Thông tin nhập quá dài"));
        }

        user.setFullname(fullname);
        user.setPhone(phone);
        user.setAddress(address);

        User saved = userRepository.save(user);

        return ResponseEntity.ok(toResponse(saved));
    }
}
