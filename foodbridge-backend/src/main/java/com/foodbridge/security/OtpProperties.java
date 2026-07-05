package com.foodbridge.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.otp")
public record OtpProperties(
    long ttlSeconds,
    int maxAttempts,
    long resendCooldownSeconds
) {
    public OtpProperties {
        ttlSeconds = ttlSeconds <= 0 ? 300 : ttlSeconds;
        maxAttempts = maxAttempts <= 0 ? 5 : maxAttempts;
        resendCooldownSeconds = resendCooldownSeconds <= 0 ? 60 : resendCooldownSeconds;
    }
}
