package com.foodbridge.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(List<String> allowedOrigins) {

    public CorsProperties {
        allowedOrigins = allowedOrigins == null || allowedOrigins.isEmpty()
            ? new ArrayList<>(List.of("http://localhost:5173", "http://127.0.0.1:5173"))
            : allowedOrigins;
    }
}
