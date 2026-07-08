package com.foodbridge.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(List<String> allowedOrigins) {

    public CorsProperties {
        List<String> defaults = List.of(
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            "https://food-bridge-rho-sooty.vercel.app"
        );
        List<String> resolvedOrigins = allowedOrigins == null || allowedOrigins.isEmpty()
            ? new ArrayList<>()
            : new ArrayList<>(allowedOrigins);
        for (String origin : defaults) {
            if (!resolvedOrigins.contains(origin)) {
                resolvedOrigins.add(origin);
            }
        }
        allowedOrigins = resolvedOrigins;
    }
}
