package se.gold.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class AuthDtos {

    @Data
    public static class RegisterRequest {
        @Email @NotBlank
        private String email;

        @NotBlank @Size(min = 6)
        private String password;

        @NotBlank
        private String firstName;

        @NotBlank
        private String lastName;

        // IR or SE
        private String country = "IR";
    }

    @Data
    public static class LoginRequest {
        @Email @NotBlank
        private String email;

        @NotBlank
        private String password;
    }

    @Data
    public static class AuthResponse {
        private String token;
        private String email;
        private String role;
        private String firstName;
        private String country;
        private String message;

        public AuthResponse(String token, String email, String role,
                            String firstName, String country) {
            this.token = token;
            this.email = email;
            this.role = role;
            this.firstName = firstName;
            this.country = country;
        }
    }
}
