
package com.dacs.fashion.config;

import lombok.RequiredArgsConstructor;

import jakarta.servlet.DispatcherType;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;

import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http
    ) throws Exception {

        http

                // =====================================================
                // CSRF
                // =====================================================

                .csrf(csrf ->
                        csrf.disable()
                )

                // =====================================================
                // SESSION
                // =====================================================

                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )

                // =====================================================
                // AUTHORIZATION
                // =====================================================

                .authorizeHttpRequests(auth -> auth

                        // Cho phép Spring Boot xử lý lỗi
                        .dispatcherTypeMatchers(
                                DispatcherType.ERROR
                        )
                        .permitAll()

                        // =================================================
                        // PUBLIC PAGES
                        // =================================================

                        .requestMatchers(
                                "/",
                                "/error",
                                "/products",
                                "/detail/**",
                                "/auth",
                                "/account",
                                "/cart",
                                "/payment",
                                "/promo",

                                // Trang tổng hợp và chi tiết BST
                                "/events",
                                "/events/**",

                                "/store",
                                "/orders",
                                "/admin",
                                "/staff",

                                "/pages",
                                "/pages/**",

                                "/css/**",
                                "/js/**",
                                "/images/**",
                                "/uploads/**",
                                "/favicon.ico",

                                "/api/auth/**"
                        )
                        .permitAll()

                        // =================================================
                        // PUBLIC PRODUCT API
                        // =================================================

                        .requestMatchers(
                                HttpMethod.GET,

                                "/api/products",
                                "/api/products/search",
                                "/api/products/category/**",
                                "/api/products/*",
                                "/api/products/*/sold-count",

                                "/api/categories/**",
                                "/api/brands/**",
                                "/api/reviews/**",
                                "/api/vouchers/**",

                                "/api/variants/product/**"
                        )
                        .permitAll()

                        // =================================================
                        // EVENT ADMIN
                        // =================================================

                        // Chỉ ADMIN được quản lý sự kiện
                        .requestMatchers(
                                "/api/events/admin",
                                "/api/events/admin/**"
                        )
                        .hasRole("ADMIN")

                        // Khách hàng được xem sự kiện
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/events",
                                "/api/events/*",
                                "/api/events/prices"
                        )
                        .permitAll()

                        // =================================================
                        // CHATBOT
                        // =================================================

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/chatbot/message"
                        )
                        .permitAll()

                        // =================================================
                        // PRODUCT - ADMIN
                        // =================================================

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/products/**"
                        )
                        .hasRole("ADMIN")

                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/products/**"
                        )
                        .hasRole("ADMIN")

                        .requestMatchers(
                                HttpMethod.DELETE,
                                "/api/products/**"
                        )
                        .hasRole("ADMIN")

                        // =================================================
                        // CATEGORY / BRAND / VOUCHER / PRODUCT IMAGE
                        // =================================================

                        .requestMatchers(
                                HttpMethod.POST,

                                "/api/categories/**",
                                "/api/brands/**",
                                "/api/vouchers/**",
                                "/api/product-images/**"
                        )
                        .hasRole("ADMIN")

                        .requestMatchers(
                                HttpMethod.PUT,

                                "/api/categories/**",
                                "/api/brands/**",
                                "/api/vouchers/**",
                                "/api/product-images/**"
                        )
                        .hasRole("ADMIN")

                        .requestMatchers(
                                HttpMethod.DELETE,

                                "/api/categories/**",
                                "/api/brands/**",
                                "/api/vouchers/**",
                                "/api/product-images/**"
                        )
                        .hasRole("ADMIN")

                        // =================================================
                        // UPLOAD IMAGE
                        // =================================================

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/upload/image"
                        )
                        .hasAnyRole(
                                "USER",
                                "ADMIN",
                                "STAFF"
                        )

                        // =================================================
                        // ACCOUNT
                        // =================================================

                        .requestMatchers(
                                "/api/account/**"
                        )
                        .hasAnyRole(
                                "USER",
                                "ADMIN",
                                "STAFF"
                        )

                        // =================================================
                        // USER ORDER
                        // =================================================

                        .requestMatchers(
                                "/api/orders/checkout",
                                "/api/orders/from-cart",
                                "/api/orders/user/**"
                        )
                        .hasAnyRole(
                                "USER",
                                "ADMIN",
                                "STAFF"
                        )

                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/orders/*/paid"
                        )
                        .hasAnyRole(
                                "USER",
                                "ADMIN",
                                "STAFF"
                        )

                        // =================================================
                        // CART + PAYOS CREATE
                        // =================================================

                        .requestMatchers(
                                "/api/cart/**",
                                "/api/payments/payos/create"
                        )
                        .hasAnyRole(
                                "USER",
                                "ADMIN",
                                "STAFF"
                        )

                        // =================================================
                        // ORDER + SHIPMENT
                        // =================================================

                        .requestMatchers(
                                "/api/orders/**",
                                "/api/shipments/**"
                        )
                        .hasAnyRole(
                                "ADMIN",
                                "STAFF"
                        )

                        // =================================================
                        // VARIANT GET
                        // =================================================

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/variants/**"
                        )
                        .hasAnyRole(
                                "ADMIN",
                                "STAFF"
                        )

                        // =================================================
                        // VARIANT POST
                        // =================================================

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/variants/**"
                        )
                        .hasAnyRole(
                                "ADMIN",
                                "STAFF"
                        )

                        // =================================================
                        // VARIANT PUT
                        // =================================================

                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/variants/**"
                        )
                        .hasAnyRole(
                                "ADMIN",
                                "STAFF"
                        )

                        // =================================================
                        // VARIANT DELETE
                        // =================================================

                        .requestMatchers(
                                HttpMethod.DELETE,
                                "/api/variants/**"
                        )
                        .hasRole("ADMIN")

                        // =================================================
                        // REVIEW
                        // =================================================

                        .requestMatchers(
                                HttpMethod.POST,

                                "/api/reviews",
                                "/api/reviews/**"
                        )
                        .hasAnyRole(
                                "USER",
                                "ADMIN",
                                "STAFF"
                        )

                        .requestMatchers(
                                HttpMethod.DELETE,
                                "/api/reviews/**"
                        )
                        .hasRole("ADMIN")

                        // =================================================
                        // ADMIN ONLY
                        // =================================================

                        .requestMatchers(
                                "/api/users/**",
                                "/api/product-images/**",
                                "/api/reports/**",
                                "/api/payments/**"
                        )
                        .hasRole("ADMIN")

                        // =================================================
                        // OTHER
                        // =================================================

                        .anyRequest()
                        .authenticated()
                )

                // =====================================================
                // DISABLE FORM LOGIN
                // =====================================================

                .formLogin(form ->
                        form.disable()
                )

                // =====================================================
                // DISABLE HTTP BASIC
                // =====================================================

                .httpBasic(basic ->
                        basic.disable()
                )

                // =====================================================
                // JWT FILTER
                // =====================================================

                .addFilterBefore(
                        jwtFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    // =========================================================
    // PASSWORD ENCODER
    // =========================================================

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
