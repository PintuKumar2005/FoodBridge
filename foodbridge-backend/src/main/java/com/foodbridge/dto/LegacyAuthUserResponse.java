package com.foodbridge.dto;

import java.time.Instant;
import java.util.Map;

public record LegacyAuthUserResponse(
    String id,
    String type,
    String email,
    String name,
    String organizationName,
    String organizationType,
    String phone,
    String address,
    String city,
    String state,
    String pincode,
    Double latitude,
    Double longitude,
    String status,
    Instant createdAt,
    Map<String, Object> details
) {
}
