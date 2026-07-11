package com.foodbridge.dto;

import com.foodbridge.entity.StoredFile;
import java.time.Instant;
import java.util.List;
import java.util.Map;

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
    Double distanceKm,
    Instant pickupTime,
    Instant expiryTime,
    String description,
    StoredFile image,
    String priority,
    Long remainingPickupWindowMinutes,
    Boolean manualReviewRequired,
    String manualReviewReason,
    Map<String, Object> aiAnalysis,
    Map<String, Object> validation,
    Map<String, Object> locationDetails,
    List<Map<String, Object>> recommendedNgos,
    String status,
    String assignedReceiverName,
    Instant createdAt
) {
}
