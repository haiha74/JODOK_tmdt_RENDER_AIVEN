package com.dacs.fashion.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/upload")
public class FileUploadController {

    @PostMapping("/image")
    public ResponseEntity<?> uploadImage(
            @RequestParam("file") MultipartFile file
    ) {
        try {

            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "File rỗng"
                        ));
            }

            String contentType = file.getContentType();

            if (contentType == null ||
                    !contentType.startsWith("image/")) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "Chỉ cho phép upload ảnh"
                        ));
            }

            long maxSize = 5 * 1024 * 1024;

            if (file.getSize() > maxSize) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "Ảnh không được vượt quá 5MB"
                        ));
            }

            String originalName = file.getOriginalFilename();

            String ext = ".jpg";

            if (originalName != null &&
                    originalName.contains(".")) {

                ext = originalName
                        .substring(
                                originalName.lastIndexOf(".")
                        )
                        .toLowerCase();
            }

            if (!ext.matches("\\.(jpg|jpeg|png|webp)$")) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "Định dạng ảnh không hợp lệ"
                        ));
            }

            String fileName =
                    UUID.randomUUID() + ext;

            Path uploadPath = Path.of(
                    System.getProperty("user.dir"),
                    "uploads"
            ).toAbsolutePath().normalize();

            Files.createDirectories(uploadPath);

            Path filePath = uploadPath
                    .resolve(fileName)
                    .normalize();

            if (!filePath.startsWith(uploadPath)) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "Tên file không hợp lệ"
                        ));
            }

            Files.copy(
                    file.getInputStream(),
                    filePath,
                    StandardCopyOption.REPLACE_EXISTING
            );

            return ResponseEntity.ok(
                    Map.of(
                            "imageUrl",
                            "/uploads/" + fileName
                    )
            );

        } catch (Exception e) {

            e.printStackTrace();

            String message = e.getMessage();

            if (message == null || message.isBlank()) {
                message = e.getClass().getSimpleName();
            }

            return ResponseEntity.internalServerError()
                    .body(Map.of(
                            "message",
                            "Upload ảnh thất bại: " + message
                    ));
        }
    }
}