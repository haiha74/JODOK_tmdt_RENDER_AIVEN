package com.dacs.fashion.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class InformationPageController {

    @GetMapping("/pages/{slug}")
    public String informationPage(@PathVariable String slug) {
        return "information-page";
    }
}
