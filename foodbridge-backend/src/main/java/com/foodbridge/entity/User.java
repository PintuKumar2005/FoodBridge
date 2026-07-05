package com.foodbridge.entity;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
@CompoundIndex(
    name = "type_1_phone_1",
    def = "{'type': 1, 'phone': 1}",
    unique = true
)public class User {

    @Id
    private String id;

    @Indexed
    private String type;

    @Builder.Default
    private Set<UserRole> roles = new HashSet<>();

    @Indexed
    private String email;

    private String password;
    private String phone;
    private String name;
    private String organizationName;
    private String organizationType;
    private String address;
    private String city;
    private String state;
    private String pincode;
    private Double latitude;
    private Double longitude;
    private String profileImageUrl;
    private String refreshTokenHash;
    private String emailVerificationToken;
    private Instant emailVerifiedAt;
    private String passwordResetToken;
    private Instant passwordResetExpiresAt;

    @Builder.Default
    private UserStatus status = UserStatus.PENDING_VERIFICATION;

    @Builder.Default
    private Map<String, Object> details = new HashMap<>();

    @Builder.Default
    private Map<String, Object> documents = new HashMap<>();

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
