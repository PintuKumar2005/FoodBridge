package com.foodbridge.dto;

import com.foodbridge.entity.StoredFile;
import java.time.Instant;

public record LegacyDonationResponse(
    String id,
    String donorId,
    String donorName,
    String organizationName,
    String foodName,
    String foodType,
    Integer quantity,
    String unit,
    String location,
    Double latitude,
    Double longitude,
    Instant pickupTime,
    Instant expiryTime,
    String description,
    StoredFile image,
    String status,
    String assignedReceiverName,
    Instant createdAt
) {
}
