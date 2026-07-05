package com.foodbridge.service.impl;

import com.foodbridge.config.SmsProperties;
import com.foodbridge.exception.BadRequestException;
import com.foodbridge.service.SmsService;
import com.foodbridge.util.PhoneNumberUtils;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Service
@RequiredArgsConstructor
public class TwilioSmsService implements SmsService {

    private final SmsProperties properties;
    private final RestClient restClient = RestClient.create();

    @Override
    public void sendOtp(String phone, String otp) {
        String provider = properties.provider();
        if (!"twilio".equalsIgnoreCase(provider)) {
            throw new BadRequestException("SMS provider must be set to twilio to send OTP messages");
        }

        SmsProperties.Twilio twilio = properties.twilio();
        if (isBlank(twilio.accountSid()) || isBlank(twilio.authToken()) || isBlank(twilio.fromNumber())) {
            throw new BadRequestException("SMS provider is not configured");
        }
        if (!twilio.fromNumber().startsWith("+")) {
            throw new BadRequestException("TWILIO_FROM_NUMBER must include country code, for example +1234567890");
        }

        String normalizedPhone = PhoneNumberUtils.normalizeIndianMobile(phone);
        if (!normalizedPhone.matches("\\d{10}")) {
            throw new BadRequestException("Enter a valid 10-digit mobile number");
        }

        var form = new LinkedMultiValueMap<String, String>();
        form.add("To", "+91" + normalizedPhone);
        form.add("From", twilio.fromNumber());
        form.add("Body", "Your FoodBridge verification code is " + otp + ". It expires in 5 minutes.");

        try {
            restClient.post()
                .uri("https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Messages.json", twilio.accountSid())
                .header(HttpHeaders.AUTHORIZATION, "Basic " + basicAuth(twilio.accountSid(), twilio.authToken()))
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            throw new BadRequestException("Twilio could not send OTP. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, and trial-number verification.");
        }
    }

    private String basicAuth(String username, String password) {
        return Base64.getEncoder().encodeToString((username + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
