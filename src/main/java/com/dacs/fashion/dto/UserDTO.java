package com.dacs.fashion.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDTO {

    private Long userId;
    private String fullname;
    private String email;
    private String phone;
    private String password;
    private String role;
    private String address;
    private String status;
}