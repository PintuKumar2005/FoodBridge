package com.foodbridge.controller;

import com.foodbridge.constants.AppConstants;
import com.foodbridge.repository.UserRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class HealthController {

    private final MongoTemplate mongoTemplate;
    private final UserRepository userRepository;

    @GetMapping("/")
    public String root() {
        return "Server Running...";
    }

    @GetMapping(AppConstants.API_PREFIX + "/health")
    public Map<String, Object> health() {
        boolean databaseConnected = false;
        long donors = 0;
        long receivers = 0;
        String databaseError = "";

        try {
            Object ok = mongoTemplate.getDb().runCommand(org.bson.Document.parse("{ ping: 1 }")).get("ok");
            databaseConnected = ok instanceof Number number && number.doubleValue() == 1.0D;
            donors = userRepository.countByType("donor");
            receivers = userRepository.countByType("receiver");
        } catch (RuntimeException ex) {
            databaseConnected = false;
            databaseError = ex.getClass().getSimpleName() + ": " + ex.getMessage();
        }

        return Map.of(
            "ok", true,
            "database", databaseConnected ? "connected" : "disconnected",
            "databaseError", databaseError,
            "donors", donors,
            "receivers", receivers
        );
    }
}
