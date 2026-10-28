package com.dacs.fashion.service;

import com.dacs.fashion.dto.UserDTO;
import com.dacs.fashion.entity.User;
import com.dacs.fashion.repository.UserRepository;
import lombok.RequiredArgsConstructor;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public List<User> getAll() {
        return userRepository.findAll();
    }

    public User getById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));
    }

    public User create(UserDTO dto) {
        if (dto.getPassword() == null || dto.getPassword().isBlank()) {
            throw new RuntimeException("Mật khẩu không được để trống");
        }
        if (userRepository.findByEmail(dto.getEmail()).isPresent()) {
            throw new RuntimeException("Email đã tồn tại");
        }

        User user = new User();
        user.setFullname(dto.getFullname());
        user.setEmail(dto.getEmail());
        user.setPhone(dto.getPhone());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        validateRole(dto.getRole());
        user.setRole(dto.getRole() != null ? dto.getRole() : "USER");
        user.setAddress(dto.getAddress());
        user.setStatus(dto.getStatus() != null ? dto.getStatus() : "ACTIVE");

        return userRepository.save(user);
    }

    public User update(Long id, UserDTO dto) {
        User user = getById(id);
        User existing = userRepository.findByEmail(dto.getEmail()).orElse(null);

        if (existing != null && !existing.getUserId().equals(id)) {
            throw new RuntimeException("Email đã tồn tại");
        }

        user.setFullname(dto.getFullname());
        user.setEmail(dto.getEmail());
        user.setPhone(dto.getPhone());

        if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
            user.setPassword(passwordEncoder.encode(dto.getPassword()));
        }
        validateRole(dto.getRole());
        user.setRole(dto.getRole() != null ? dto.getRole() : user.getRole());
        user.setAddress(dto.getAddress());
        user.setStatus(dto.getStatus() != null ? dto.getStatus() : user.getStatus());

        return userRepository.save(user);
    }

    public void delete(Long id) {
        userRepository.deleteById(id);
    }

    private void validateRole(String role) {
        if (role == null) return;

        if (!List.of("USER", "STAFF", "ADMIN").contains(role)) {
            throw new RuntimeException("Vai trò không hợp lệ");
        }
    }
}