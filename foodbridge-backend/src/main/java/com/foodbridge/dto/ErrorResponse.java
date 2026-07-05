package com.foodbridge.dto;

import java.time.Instant;
import java.util.Map;

public record ErrorResponse(
    String message,
    int status,
    String path,
    Map<String, String> errors,
    Instant timestamp
) {
}
