package com.dacs.fashion.config;

import com.dacs.fashion.entity.User;
import com.dacs.fashion.repository.UserRepository;

import io.jsonwebtoken.Claims;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import org.springframework.security.core.authority.SimpleGrantedAuthority;

import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.stereotype.Component;

import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;


    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {


        // =====================================================
        // 1. LẤY AUTHORIZATION HEADER
        // =====================================================

        String header =
                request.getHeader("Authorization");


        // =====================================================
        // 2. KHÔNG CÓ BEARER TOKEN
        // =====================================================

        if (
                header == null ||
                !header.startsWith("Bearer ")
        ) {

            filterChain.doFilter(
                    request,
                    response
            );

            return;
        }


        try {


            // =================================================
            // 3. LẤY TOKEN
            // =================================================

            String token =
                    header.substring(7);


            // =================================================
            // 4. ĐỌC JWT
            // =================================================

            Claims claims =
                    jwtUtil.getClaims(token);


            String email =
                    claims.getSubject();


            // =================================================
            // 5. TÌM USER TRONG DATABASE
            // =================================================

            User user =
                    userRepository
                            .findByEmail(email)
                            .orElse(null);


            if (user == null) {

                System.err.println(
                        "[JWT] USER NOT FOUND: "
                                + email
                );


                SecurityContextHolder
                        .clearContext();


                filterChain.doFilter(
                        request,
                        response
                );


                return;
            }


            // =================================================
            // 6. KIỂM TRA STATUS
            // =================================================

            String status =
                    user.getStatus() == null
                            ? ""
                            : user
                                    .getStatus()
                                    .trim();


            if (
                    !"ACTIVE"
                            .equalsIgnoreCase(status)
            ) {

                System.err.println(
                        "[JWT] USER NOT ACTIVE: "
                                + email
                                + " | status="
                                + status
                );


                SecurityContextHolder
                        .clearContext();


                filterChain.doFilter(
                        request,
                        response
                );


                return;
            }


            // =================================================
            // 7. LẤY ROLE
            // =================================================

            String role =
                    user.getRole() == null
                            ? ""
                            : user
                                    .getRole()
                                    .trim()
                                    .toUpperCase();


            // =================================================
            // 8. CHUẨN HÓA AUTHORITY
            //
            // ADMIN      -> ROLE_ADMIN
            // ROLE_ADMIN -> ROLE_ADMIN
            //
            // STAFF      -> ROLE_STAFF
            // ROLE_STAFF -> ROLE_STAFF
            // =================================================

            String authority =
                    role.startsWith("ROLE_")
                            ? role
                            : "ROLE_" + role;


            // =================================================
            // 9. TẠO AUTHENTICATION
            // =================================================

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                            user,
                            null,
                            List.of(
                                    new SimpleGrantedAuthority(
                                            authority
                                    )
                            )
                    );


            // =================================================
            // 10. ĐƯA AUTH VÀO SPRING SECURITY
            // =================================================

            SecurityContextHolder
                    .getContext()
                    .setAuthentication(
                            authentication
                    );


            // =================================================
            // DEBUG
            // =================================================

            System.out.println(
                    "[JWT] "
                            + request.getMethod()
                            + " "
                            + request.getRequestURI()
                            + " | "
                            + email
                            + " | DB ROLE="
                            + user.getRole()
                            + " | AUTH="
                            + authentication.getAuthorities()
            );


        } catch (Exception e) {


            // =================================================
            // TOKEN KHÔNG HỢP LỆ
            // =================================================

            SecurityContextHolder
                    .clearContext();


            System.err.println(
                    "[JWT ERROR] "
                            + request.getMethod()
                            + " "
                            + request.getRequestURI()
            );


            System.err.println(
                    "[JWT ERROR] "
                            + e.getClass().getName()
                            + ": "
                            + e.getMessage()
            );


            e.printStackTrace();
        }


        // =====================================================
        // 11. CHẠY FILTER TIẾP
        // =====================================================

        filterChain.doFilter(
                request,
                response
        );
    }
}