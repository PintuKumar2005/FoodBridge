package com.foodbridge.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
    String secret,
    long accessTokenExpirationMs,
    long refreshTokenExpirationMs
) {
    public JwtProperties {
        if (secret == null || secret.length() < 32 || secret.startsWith("replace-this")) {
            throw new IllegalStateException("JWT_SECRET must be set to at least 32 characters");
        }
        accessTokenExpirationMs = accessTokenExpirationMs <= 0 ? 900_000 : accessTokenExpirationMs;
        refreshTokenExpirationMs = refreshTokenExpirationMs <= 0 ? 604_800_000 : refreshTokenExpirationMs;
    }
}
