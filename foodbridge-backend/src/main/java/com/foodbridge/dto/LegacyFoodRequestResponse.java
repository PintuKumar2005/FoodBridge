package com.foodbridge.dto;

import java.time.Instant;

public record LegacyFoodRequestResponse(
    String id,
    String foodId,
    String donorId,
    String receiverId,
    String foodName,
    String foodType,
    String donorOrg,
    String receiverName,
    String receiverOrg,
    String receiverType,
    String message,
    String status,
    Instant requestedAt
) {
}
