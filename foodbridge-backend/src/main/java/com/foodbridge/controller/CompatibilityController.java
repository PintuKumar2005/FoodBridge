package com.foodbridge.controller;

import com.foodbridge.constants.AppConstants;
import com.foodbridge.service.CompatibilityApiService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping(AppConstants.API_PREFIX)
public class CompatibilityController {

    private final CompatibilityApiService compatibilityApiService;

    @PostMapping("/donors")
    public Map<String, Object> registerDonor(@RequestBody Map<String, Object> payload) {
        return compatibilityApiService.registerDonor(payload);
    }

    @PostMapping("/receivers")
    public Map<String, Object> registerReceiver(@RequestBody Map<String, Object> payload) {
        return compatibilityApiService.registerReceiver(payload);
    }

    @PostMapping("/auth/send-otp")
    public Map<String, Object> sendOtp(@RequestBody Map<String, Object> payload) {
        return compatibilityApiService.sendOtp(payload);
    }

    @PostMapping("/auth/direct-login")
    public Map<String, Object> directLogin(@RequestBody Map<String, Object> payload) {
        return compatibilityApiService.directLogin(payload);
    }

    @PostMapping("/auth/verify-otp")
    public Map<String, Object> verifyOtp(@RequestBody Map<String, Object> payload) {
        return compatibilityApiService.verifyOtp(payload);
    }

    @PostMapping("/donations")
    public Map<String, Object> createDonation(@RequestBody Map<String, Object> payload) {
        return compatibilityApiService.createDonation(payload);
    }

    @GetMapping("/donations")
    public Map<String, Object> getDonations(
        @RequestParam(required = false) String donorId,
        @RequestParam(required = false) String status
    ) {
        return compatibilityApiService.getDonations(donorId, status);
    }

    @DeleteMapping("/donations/{id}")
    public Map<String, Object> deleteDonation(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        return compatibilityApiService.deleteDonation(id, payload);
    }

    @PostMapping("/food-requests")
    public Map<String, Object> createFoodRequest(@RequestBody Map<String, Object> payload) {
        return compatibilityApiService.createFoodRequest(payload);
    }

    @GetMapping("/food-requests")
    public Map<String, Object> getFoodRequests(
        @RequestParam(required = false) String donorId,
        @RequestParam(required = false) String receiverId
    ) {
        return compatibilityApiService.getFoodRequests(donorId, receiverId);
    }

    @PatchMapping("/food-requests/{id}")
    public Map<String, Object> updateFoodRequest(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        return compatibilityApiService.updateFoodRequest(id, payload);
    }

    @GetMapping("/profile")
    public Map<String, Object> getProfile(@RequestParam(required = false) String userId) {
        return compatibilityApiService.getProfile(userId);
    }

    @GetMapping("/notifications")
    public Map<String, Object> getNotifications(@RequestParam(required = false) String userId) {
        return compatibilityApiService.getNotifications(userId);
    }

    @GetMapping("/messages")
    public Map<String, Object> getMessages(@RequestParam(required = false) String userId) {
        return compatibilityApiService.getMessages(userId);
    }

    @GetMapping("/analytics")
    public Map<String, Object> getAnalytics(@RequestParam(required = false) String userId) {
        return compatibilityApiService.getAnalytics(userId);
    }

    @GetMapping("/admin/users")
    public Map<String, Object> getAdminUsers() {
        return compatibilityApiService.getAdminUsers();
    }

    @DeleteMapping("/admin/users/{id}")
    public Map<String, Object> deleteAdminUser(@PathVariable String id) {
        return compatibilityApiService.deleteAdminUser(id);
    }

    @DeleteMapping("/admin/donations/{id}")
    public Map<String, Object> deleteAdminDonation(@PathVariable String id) {
        return compatibilityApiService.deleteAdminDonation(id);
    }

    @DeleteMapping("/admin/food-requests/{id}")
    public Map<String, Object> deleteAdminFoodRequest(@PathVariable String id) {
        return compatibilityApiService.deleteAdminFoodRequest(id);
    }
}
