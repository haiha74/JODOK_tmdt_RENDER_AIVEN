package com.dacs.fashion.service;

import com.dacs.fashion.dto.LoginDTO;
import com.dacs.fashion.dto.UserDTO;
import com.dacs.fashion.entity.User;
import com.dacs.fashion.repository.UserRepository;
import lombok.RequiredArgsConstructor;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.dacs.fashion.config.JwtUtil;
import java.util.Map;


@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    private static final java.util.regex.Pattern EMAIL_PATTERN = java.util.regex.Pattern.compile(
            "^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(java.util.Locale.ROOT);
    }

    public User register(UserDTO dto) {
        if (dto == null) throw new IllegalArgumentException("Dữ liệu đăng ký không hợp lệ");
        String fullname = dto.getFullname() == null ? "" : dto.getFullname().trim().replaceAll("\\s+", " ");
        String email = normalizeEmail(dto.getEmail());
        String password = dto.getPassword();

        if (fullname.length() < 2 || fullname.length() > 255) {
            throw new IllegalArgumentException("Họ tên phải có từ 2 đến 255 ký tự");
        }
        if (email.length() > 255 || !EMAIL_PATTERN.matcher(email).matches()) {
            throw new IllegalArgumentException("Email không hợp lệ");
        }
        if (password == null || password.length() < 8 || password.length() > 72
                || !password.matches("(?s).*\\p{L}.*") || !password.matches("(?s).*\\d.*")) {
            throw new IllegalArgumentException("Mật khẩu phải có 8–72 ký tự, gồm chữ và số");
        }
        // So khớp không phân biệt hoa thường, kể cả với dữ liệu cũ trong database.
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email đã được sử dụng");
        }

        User user = new User();
        user.setFullname(fullname);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setPhone("");
        user.setAddress("");
        user.setRole("USER");
        user.setStatus("ACTIVE");
        return userRepository.save(user);
    }

    public Map<String, Object> login(LoginDTO dto) {
        if (dto == null) throw new IllegalArgumentException("Vui lòng nhập email và mật khẩu");
        String email = normalizeEmail(dto.getEmail());
        String password = dto.getPassword();
        if (email.isEmpty() || password == null || password.isEmpty()) {
            throw new IllegalArgumentException("Vui lòng nhập email và mật khẩu");
        }
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("Email hoặc mật khẩu không chính xác"));
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new IllegalArgumentException("Email hoặc mật khẩu không chính xác");
        }
        if (!"ACTIVE".equals(user.getStatus())) {
            throw new IllegalArgumentException("Tài khoản đã bị khóa");
        }
        String token = jwtUtil.generateToken(user);
        return Map.of(
                "token", token,
                "userId", user.getUserId(),
                "fullname", user.getFullname(),
                "email", user.getEmail(),
                "role", user.getRole(),
                "status", user.getStatus()
        );
    }
}
