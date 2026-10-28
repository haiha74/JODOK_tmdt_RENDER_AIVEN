package com.dacs.fashion.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

    @GetMapping("/")
    public String home() {
        return "index";
    }

    @GetMapping("/products")
    public String products() {
        return "products";
    }

    @GetMapping("/detail")
    public String detail() {
        return "detail";
    }

    @GetMapping("/events")
    public String eventCollections() {
        return "events";
    }

    @GetMapping("/events/{slug}")
    public String events() { 
        return "events"; 
    }

    @GetMapping("/promo")
    public String promo() {
        return "promo";
    }

    @GetMapping("/store")
    public String store() {
        return "store";
    }

    @GetMapping("/auth")
    public String auth() {
        return "auth";
    }
    @GetMapping("/account")
    public String account() {
        return "account";
    }
    @GetMapping("/cart")
    public String cart() {
        return "cart";
    }

    @GetMapping("/orders")
    public String orders() {
        return "orders";
    }

    @GetMapping("/payment")
    public String payment() {
        return "payment";
    }

    @GetMapping("/admin")
    public String admin() {
        return "admin";
    }

    @GetMapping("/staff")
    public String staff() {
        return "staff";
    }


}