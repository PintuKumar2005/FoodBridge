package com.foodbridge.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.sms")
public record SmsProperties(
    String provider,
    Twilio twilio
) {
    public SmsProperties {
        provider = provider == null || provider.isBlank() ? "log" : provider;
        twilio = twilio == null ? new Twilio("", "", "") : twilio;
    }

    public record Twilio(
        String accountSid,
        String authToken,
        String fromNumber
    ) {
    }
}
