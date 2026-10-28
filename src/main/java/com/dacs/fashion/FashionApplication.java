package com.dacs.fashion;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FashionApplication {
    public static void main(String[] args) {
        SpringApplication.run(FashionApplication.class, args);
    }
}
