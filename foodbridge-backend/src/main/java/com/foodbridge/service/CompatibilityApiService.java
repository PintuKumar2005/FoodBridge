package com.foodbridge.service;

import java.util.Map;

public interface CompatibilityApiService {

    Map<String, Object> registerDonor(Map<String, Object> payload);

    Map<String, Object> registerReceiver(Map<String, Object> payload);

    Map<String, Object> sendOtp(Map<String, Object> payload);

    Map<String, Object> directLogin(Map<String, Object> payload);

    Map<String, Object> verifyOtp(Map<String, Object> payload);

    Map<String, Object> createDonation(Map<String, Object> payload);

    Map<String, Object> getDonations(String donorId, String status);

    Map<String, Object> deleteDonation(String id, Map<String, Object> payload);

    Map<String, Object> createFoodRequest(Map<String, Object> payload);

    Map<String, Object> getFoodRequests(String donorId, String receiverId);

    Map<String, Object> updateFoodRequest(String id, Map<String, Object> payload);

    Map<String, Object> getProfile(String userId);

    Map<String, Object> getNotifications(String userId);

    Map<String, Object> getMessages(String userId);

    Map<String, Object> getAnalytics(String userId);

    Map<String, Object> getAdminUsers();

    Map<String, Object> deleteAdminUser(String id);

    Map<String, Object> deleteAdminDonation(String id);

    Map<String, Object> deleteAdminFoodRequest(String id);
}
