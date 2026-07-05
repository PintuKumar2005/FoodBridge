package com.foodbridge.service.impl;

import com.foodbridge.entity.Donation;
import com.foodbridge.entity.FoodRequest;
import com.foodbridge.entity.Notification;
import com.foodbridge.entity.NotificationType;
import com.foodbridge.entity.StoredFile;
import com.foodbridge.entity.User;
import com.foodbridge.entity.UserRole;
import com.foodbridge.entity.UserStatus;
import com.foodbridge.exception.BadRequestException;
import com.foodbridge.exception.ConflictException;
import com.foodbridge.exception.ResourceNotFoundException;
import com.foodbridge.mapper.LegacyResponseMapper;
import com.foodbridge.repository.DonationRepository;
import com.foodbridge.repository.FoodRequestRepository;
import com.foodbridge.repository.NotificationRepository;
import com.foodbridge.repository.UserRepository;
import com.foodbridge.security.AuthenticatedUser;
import com.foodbridge.security.JwtService;
import com.foodbridge.security.OtpProperties;
import com.foodbridge.service.CompatibilityApiService;
import com.foodbridge.util.PhoneNumberUtils;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CompatibilityApiServiceImpl implements CompatibilityApiService {

    private final UserRepository userRepository;
    private final DonationRepository donationRepository;
    private final FoodRequestRepository foodRequestRepository;
    private final NotificationRepository notificationRepository;
    private final LegacyResponseMapper mapper;
    private final JwtService jwtService;
    private final OtpProperties otpProperties;
    private final Map<String, OtpChallenge> otps = new ConcurrentHashMap<>();
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${app.matching.nearby-radius-km:10}")
    private double nearbyRadiusKm;

    @Override
    public Map<String, Object> registerDonor(Map<String, Object> payload) {
        requireFields(payload, List.of("businessName", "businessType", "ownerName", "phone", "email", "address", "city", "state", "pincode"));

        String phone = PhoneNumberUtils.normalizeIndianMobile(value(payload, "phone"));
        if (!phone.matches("\\d{10}")) {
            throw new BadRequestException("Enter a valid 10-digit mobile number");
        }
        if (!value(payload, "email").matches("^\\S+@\\S+\\.\\S+$")) {
            throw new BadRequestException("Enter a valid email address");
        }
        if (!value(payload, "pincode").matches("\\d{6}")) {
            throw new BadRequestException("Enter a valid 6-digit pincode");
        }
        Map<String, Object> documents = validatedDocuments(objectMap(payload.get("documents")));
        if (!documents.containsKey("identityProof")) {
            throw new BadRequestException("Identity proof is required");
        }
        if (userRepository.existsByTypeAndPhone("donor", phone)) {
            throw new ConflictException("A donor with this phone number already exists");
        }

        User user = User.builder()
            .type("donor")
            .roles(new HashSet<>(Set.of(UserRole.DONOR)))
            .status(UserStatus.ACTIVE)
            .email(value(payload, "email").toLowerCase())
            .phone(phone)
            .name(value(payload, "ownerName"))
            .organizationName(value(payload, "businessName"))
            .organizationType(value(payload, "businessType"))
            .address(value(payload, "address"))
            .city(value(payload, "city"))
            .state(value(payload, "state"))
            .pincode(value(payload, "pincode"))
            .latitude(doubleValueOrNull(payload.get("latitude")))
            .longitude(doubleValueOrNull(payload.get("longitude")))
            .details(details(payload, List.of("fssaiLicenseNumber", "businessRegistrationNumber", "foodType", "averageDailySurplus", "pickupAvailability", "latitude", "longitude")))
            .documents(documents)
            .build();

        user = userRepository.save(user);
        return authResponse("Donor registered successfully", user);
    }

    @Override
    public Map<String, Object> registerReceiver(Map<String, Object> payload) {
        requireFields(payload, List.of("organizationName", "organizationType", "contactName", "phone", "email", "address", "city", "state", "pincode"));

        String phone = PhoneNumberUtils.normalizeIndianMobile(value(payload, "phone"));
        if (userRepository.existsByTypeAndPhone("receiver", phone)) {
            throw new ConflictException("A receiver with this phone number already exists");
        }

        User user = User.builder()
            .type("receiver")
            .roles(new HashSet<>(Set.of(UserRole.RECEIVER, UserRole.NGO)))
            .status(UserStatus.ACTIVE)
            .email(value(payload, "email").toLowerCase())
            .phone(phone)
            .name(value(payload, "contactName"))
            .organizationName(value(payload, "organizationName"))
            .organizationType(value(payload, "organizationType"))
            .address(value(payload, "address"))
            .city(value(payload, "city"))
            .state(value(payload, "state"))
            .pincode(value(payload, "pincode"))
            .latitude(doubleValueOrNull(payload.get("latitude")))
            .longitude(doubleValueOrNull(payload.get("longitude")))
            .details(details(payload, List.of("registrationNumber", "numberOfResidents", "foodPreference", "canArrangePickup", "latitude", "longitude")))
            .build();

        user = userRepository.save(user);
        return authResponse("Receiver registered successfully", user);
    }

    @Override
    public Map<String, Object> sendOtp(Map<String, Object> payload) {
        String role = role(payload);
        String phone = PhoneNumberUtils.normalizeIndianMobile(value(payload, "phone"));
        if (phone.isBlank()) {
            throw new BadRequestException("Phone number is required");
        }

        userRepository.findByTypeAndPhone(role, phone)
            .orElseThrow(() -> new ResourceNotFoundException("No " + role + " found for this phone number"));

        String key = role + ":" + phone;
        OtpChallenge existing = otps.get(key);
        Instant now = Instant.now();
        if (existing != null && now.isBefore(existing.lastSentAt().plusSeconds(otpProperties.resendCooldownSeconds()))) {
            return Map.of("message", "Dummy OTP already generated.", "otp", existing.code());
        }

        String otp = "%06d".formatted(secureRandom.nextInt(1_000_000));
        otps.put(key, new OtpChallenge(otp, now.plusSeconds(otpProperties.ttlSeconds()), 0, now));
        return Map.of("message", "Dummy OTP generated successfully.", "otp", otp);
    }

    @Override
    public Map<String, Object> directLogin(Map<String, Object> payload) {
        throw new BadRequestException("Use OTP verification to log in");
    }

    @Override
    public Map<String, Object> verifyOtp(Map<String, Object> payload) {
        String role = role(payload);
        String phone = PhoneNumberUtils.normalizeIndianMobile(value(payload, "phone"));
        String key = role + ":" + phone;
        OtpChallenge challenge = otps.get(key);
        if (challenge == null || Instant.now().isAfter(challenge.expiresAt())) {
            otps.remove(key);
            throw new BadRequestException("OTP expired. Please request a new OTP");
        }
        if (challenge.attempts() >= otpProperties.maxAttempts()) {
            otps.remove(key);
            throw new BadRequestException("Too many invalid OTP attempts. Please request a new OTP");
        }
        if (!String.valueOf(payload.getOrDefault("otp", "")).trim().equals(challenge.code())) {
            otps.put(key, challenge.withAttempt());
            throw new BadRequestException("Invalid OTP");
        }

        User user = userRepository.findByTypeAndPhone(role, phone)
            .orElseThrow(() -> new ResourceNotFoundException("No " + role + " found for this phone number"));
        otps.remove(key);
        return authResponse("Login successful", user);
    }

    @Override
    public Map<String, Object> createDonation(Map<String, Object> payload) {
        requireFields(payload, List.of("foodName", "foodType", "quantity", "location", "pickupTime", "expiryTime"));

        User donor = currentUser(UserRole.DONOR);

        int quantity = intValue(payload.get("quantity"));
        if (quantity < 1) {
            throw new BadRequestException("Quantity must be at least 1");
        }

        Instant expiryTime = instant(value(payload, "expiryTime"));
        if (!expiryTime.isAfter(Instant.now())) {
            throw new BadRequestException("Expiry time must be in the future");
        }

        Double donationLatitude = doubleValueOrNull(payload.get("latitude"));
        Double donationLongitude = doubleValueOrNull(payload.get("longitude"));
        if (donationLatitude == null) {
            donationLatitude = donor.getLatitude();
        }
        if (donationLongitude == null) {
            donationLongitude = donor.getLongitude();
        }

        Donation donation = Donation.builder()
            .donorId(donor.getId())
            .donorName(donor.getName())
            .organizationName(donor.getOrganizationName())
            .foodName(value(payload, "foodName"))
            .foodType(value(payload, "foodType"))
            .quantity(quantity)
            .unit(valueOrDefault(payload, "unit", "Meals"))
            .location(value(payload, "location"))
            .latitude(donationLatitude)
            .longitude(donationLongitude)
            .pickupTime(instant(value(payload, "pickupTime")))
            .expiryTime(expiryTime)
            .description(valueOrDefault(payload, "description", ""))
            .image(storedFile(payload.get("image")))
            .status("available")
            .assignedReceiverName("")
            .build();

        donation = donationRepository.save(donation);
        int notifiedReceivers = notifyNearbyReceivers(donation);
        return Map.of("message", "Food donation published", "donation", mapper.toPublicDonation(donation), "notifiedReceivers", notifiedReceivers);
    }

    @Override
    public Map<String, Object> getDonations(String donorId, String status) {
        List<Donation> donations;
        AuthenticatedUser current = authenticatedUser();
        if (current.roles().contains(UserRole.ADMIN)) {
            donations = donorId != null && !donorId.isBlank()
                ? donationRepository.findByDonorIdOrderByCreatedAtDesc(donorId)
                : donationRepository.findAllByOrderByCreatedAtDesc();
        } else if ("donor".equals(current.type())) {
            donations = donationRepository.findByDonorIdOrderByCreatedAtDesc(current.id());
        } else if ("receiver".equals(current.type())) {
            User receiver = currentUser();
            donations = donationRepository.findByStatusInOrderByCreatedAtDesc(List.of("available", "requested")).stream()
                .filter(donation -> isNearby(receiver, donation))
                .toList();
        } else {
            donations = List.of();
        }
        return Map.of("donations", donations.stream().map(mapper::toPublicDonation).toList());
    }

    @Override
    public Map<String, Object> deleteDonation(String id, Map<String, Object> payload) {
        Donation donation = donationRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Donation not found"));
        AuthenticatedUser current = authenticatedUser();
        if (!current.roles().contains(UserRole.ADMIN) && !donation.getDonorId().equals(current.id())) {
            throw new BadRequestException("Only the owner can delete this donation");
        }
        if (List.of("assigned", "collected").contains(donation.getStatus())) {
            throw new ConflictException("Assigned or collected donations cannot be deleted");
        }
        foodRequestRepository.deleteByFoodId(donation.getId());
        donationRepository.delete(donation);
        return Map.of("message", "Donation deleted");
    }

    @Override
    public Map<String, Object> createFoodRequest(Map<String, Object> payload) {
        Donation donation = donationRepository.findById(value(payload, "foodId"))
            .orElseThrow(() -> new ResourceNotFoundException("Donation not found"));
        User receiver = currentUser(UserRole.RECEIVER);
        if (!List.of("available", "requested").contains(donation.getStatus())) {
            throw new ConflictException("This food is no longer available");
        }
        if (!isNearby(receiver, donation)) {
            throw new BadRequestException("This donation is outside your nearby pickup area");
        }

        FoodRequest request = FoodRequest.builder()
            .foodId(donation.getId())
            .donorId(donation.getDonorId())
            .receiverId(receiver.getId())
            .foodName(donation.getFoodName())
            .foodType(donation.getFoodType())
            .donorOrg(donation.getOrganizationName())
            .receiverName(receiver.getName())
            .receiverOrg(receiver.getOrganizationName())
            .receiverType(receiver.getOrganizationType())
            .message(valueOrDefault(payload, "message", ""))
            .status("pending")
            .build();

        try {
            request = foodRequestRepository.save(request);
        } catch (DuplicateKeyException ex) {
            throw new ConflictException("You have already requested this food");
        }
        donation.setStatus("requested");
        donationRepository.save(donation);
        return Map.of("message", "Food request sent", "request", mapper.toPublicRequest(request));
    }

    @Override
    public Map<String, Object> getFoodRequests(String donorId, String receiverId) {
        List<FoodRequest> requests;
        AuthenticatedUser current = authenticatedUser();
        if (current.roles().contains(UserRole.ADMIN)) {
            if (donorId != null && !donorId.isBlank()) {
                requests = foodRequestRepository.findByDonorIdOrderByCreatedAtDesc(donorId);
            } else if (receiverId != null && !receiverId.isBlank()) {
                requests = foodRequestRepository.findByReceiverIdOrderByCreatedAtDesc(receiverId);
            } else {
                requests = foodRequestRepository.findAllByOrderByCreatedAtDesc();
            }
        } else if ("donor".equals(current.type())) {
            requests = foodRequestRepository.findByDonorIdOrderByCreatedAtDesc(current.id());
        } else if ("receiver".equals(current.type())) {
            requests = foodRequestRepository.findByReceiverIdOrderByCreatedAtDesc(current.id());
        } else {
            requests = List.of();
        }
        return Map.of("requests", requests.stream().map(mapper::toPublicRequest).toList());
    }

    @Override
    public Map<String, Object> updateFoodRequest(String id, Map<String, Object> payload) {
        FoodRequest request = foodRequestRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Request not found"));
        String action = value(payload, "action");
        String userId = authenticatedUser().id();

        if (List.of("approve", "reject").contains(action) && !request.getDonorId().equals(userId)) {
            throw new BadRequestException("Only this donation's donor can update the request");
        }
        if ("collected".equals(action) && !request.getReceiverId().equals(userId)) {
            throw new BadRequestException("Only this receiver can confirm collection");
        }

        Donation donation = donationRepository.findById(request.getFoodId()).orElse(null);
        if ("approve".equals(action)) {
            if (!"pending".equals(request.getStatus())) {
                throw new ConflictException("Request has already been handled");
            }
            request.setStatus("approved");
            for (FoodRequest other : foodRequestRepository.findAll()) {
                if (request.getFoodId().equals(other.getFoodId()) && !request.getId().equals(other.getId()) && "pending".equals(other.getStatus())) {
                    other.setStatus("rejected");
                    foodRequestRepository.save(other);
                }
            }
            if (donation != null) {
                donation.setStatus("assigned");
                donation.setAssignedReceiverId(request.getReceiverId());
                donation.setAssignedReceiverName(request.getReceiverOrg());
                donationRepository.save(donation);
            }
        } else if ("reject".equals(action)) {
            request.setStatus("rejected");
            if (donation != null && foodRequestRepository.countByFoodIdAndStatus(request.getFoodId(), "pending") == 0) {
                donation.setStatus("available");
                donationRepository.save(donation);
            }
        } else if ("collected".equals(action)) {
            if (!"approved".equals(request.getStatus())) {
                throw new ConflictException("Only approved requests can be collected");
            }
            request.setStatus("collected");
            if (donation != null) {
                donation.setStatus("collected");
                donationRepository.save(donation);
            }
        } else {
            throw new BadRequestException("Invalid request action");
        }

        request = foodRequestRepository.save(request);
        return Map.of("message", "Request updated", "request", mapper.toPublicRequest(request));
    }

    @Override
    public Map<String, Object> getProfile(String userId) {
        Map<String, Object> response = new HashMap<>();
        AuthenticatedUser current = authenticatedUser();
        String effectiveUserId = current.roles().contains(UserRole.ADMIN) && userId != null && !userId.isBlank() ? userId : current.id();
        User user = userRepository.findById(effectiveUserId)
            .orElseThrow(() -> new ResourceNotFoundException("Profile not found"));
        response.put("profile", profile(user));
        return response;
    }

    @Override
    public Map<String, Object> getNotifications(String userId) {
        User user = currentUser();

        List<FoodRequest> requests = "donor".equals(user.getType())
            ? foodRequestRepository.findByDonorIdOrderByCreatedAtDesc(user.getId())
            : foodRequestRepository.findByReceiverIdOrderByCreatedAtDesc(user.getId());

        List<Map<String, Object>> storedNotifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
            .map(this::storedNotification)
            .toList();

        List<Map<String, Object>> requestNotifications = requests.stream()
            .limit(20)
            .map(request -> notification(user, request))
            .toList();

        List<Map<String, Object>> notifications = new ArrayList<>();
        notifications.addAll(storedNotifications);
        notifications.addAll(requestNotifications);
        notifications.sort((first, second) -> String.valueOf(second.get("createdAt")).compareTo(String.valueOf(first.get("createdAt"))));

        return Map.of("notifications", notifications.stream().limit(30).toList());
    }

    @Override
    public Map<String, Object> getMessages(String userId) {
        authenticatedUser();
        return Map.of("messages", List.of());
    }

    @Override
    public Map<String, Object> getAnalytics(String userId) {
        User user = currentUser();

        if ("receiver".equals(user.getType())) {
            List<FoodRequest> requests = foodRequestRepository.findByReceiverIdOrderByCreatedAtDesc(user.getId());
            long completed = requests.stream().filter(request -> "collected".equals(request.getStatus())).count();
            long successful = requests.stream().filter(request -> List.of("approved", "collected").contains(request.getStatus())).count();
            int successRate = requests.isEmpty() ? 0 : Math.round((successful * 100f) / requests.size());
            return Map.of(
                "mealsReceived", completed,
                "successRate", successRate,
                "activeDonations", requests.stream().filter(request -> "approved".equals(request.getStatus())).count()
            );
        }

        List<Donation> donations = donationRepository.findByDonorIdOrderByCreatedAtDesc(user.getId());
        List<FoodRequest> requests = foodRequestRepository.findByDonorIdOrderByCreatedAtDesc(user.getId());
        return Map.of(
            "totalDonations", donations.size(),
            "activeDonations", donations.stream().filter(donation -> !"collected".equals(donation.getStatus())).count(),
            "completedDonations", donations.stream().filter(donation -> "collected".equals(donation.getStatus())).count(),
            "pendingRequests", requests.stream().filter(request -> "pending".equals(request.getStatus())).count()
        );
    }

    @Override
    public Map<String, Object> getAdminUsers() {
        List<Map<String, Object>> users = userRepository.findAll().stream()
            .filter(user -> !"admin".equals(user.getType()))
            .map(this::adminUser)
            .toList();
        return Map.of("users", users);
    }

    @Override
    public Map<String, Object> deleteAdminUser(String id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if ("donor".equals(user.getType())) {
            foodRequestRepository.deleteByDonorId(user.getId());
            donationRepository.deleteByDonorId(user.getId());
        } else if ("receiver".equals(user.getType())) {
            foodRequestRepository.deleteByReceiverId(user.getId());
        }
        userRepository.delete(user);
        return Map.of("message", "User deleted");
    }

    @Override
    public Map<String, Object> deleteAdminDonation(String id) {
        Donation donation = donationRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Donation not found"));
        foodRequestRepository.deleteByFoodId(donation.getId());
        donationRepository.delete(donation);
        return Map.of("message", "Donation deleted");
    }

    @Override
    public Map<String, Object> deleteAdminFoodRequest(String id) {
        FoodRequest request = foodRequestRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Request not found"));
        foodRequestRepository.delete(request);

        Donation donation = donationRepository.findById(request.getFoodId()).orElse(null);
        if (donation != null && !"collected".equals(donation.getStatus())) {
            long activeRequests = foodRequestRepository.countByFoodIdAndStatus(request.getFoodId(), "pending")
                + foodRequestRepository.countByFoodIdAndStatus(request.getFoodId(), "approved");
            donation.setStatus(activeRequests > 0 ? "requested" : "available");
            donation.setAssignedReceiverId("");
            donation.setAssignedReceiverName("");
            donationRepository.save(donation);
        }
        return Map.of("message", "Request deleted");
    }

    private Map<String, Object> adminUser(User user) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", user.getId());
        data.put("type", user.getType());
        data.put("email", user.getEmail());
        data.put("name", user.getName());
        data.put("organizationName", user.getOrganizationName());
        data.put("organizationType", user.getOrganizationType());
        data.put("phone", user.getPhone());
        data.put("address", user.getAddress());
        data.put("city", user.getCity());
        data.put("state", user.getState());
        data.put("pincode", user.getPincode());
        data.put("latitude", user.getLatitude());
        data.put("longitude", user.getLongitude());
        data.put("status", user.getStatus());
        data.put("createdAt", user.getCreatedAt());
        data.put("details", user.getDetails());
        data.put("documents", user.getDocuments());
        return data;
    }

    private Map<String, Object> profile(User user) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", user.getId());
        data.put("type", user.getType());
        data.put("email", user.getEmail());
        data.put("name", user.getName());
        data.put("organizationName", user.getOrganizationName());
        data.put("organizationType", user.getOrganizationType());
        data.put("phone", user.getPhone());
        data.put("address", user.getAddress());
        data.put("city", user.getCity());
        data.put("state", user.getState());
        data.put("pincode", user.getPincode());
        data.put("latitude", user.getLatitude());
        data.put("longitude", user.getLongitude());
        data.put("status", user.getStatus());
        data.put("createdAt", user.getCreatedAt());
        data.put("details", user.getDetails());
        data.put("documents", user.getDocuments());
        return data;
    }

    private Map<String, Object> notification(User user, FoodRequest request) {
        Map<String, Object> data = new HashMap<>();
        boolean donor = "donor".equals(user.getType());
        String title = "pending".equals(request.getStatus()) ? "Food request pending" : "Food request " + request.getStatus();
        String detail = donor
            ? request.getReceiverOrg() + " requested " + request.getFoodName() + "."
            : request.getFoodName() + " from " + request.getDonorOrg() + " is " + request.getStatus() + ".";
        data.put("id", request.getId());
        data.put("title", title);
        data.put("subject", title);
        data.put("message", detail);
        data.put("detail", detail);
        data.put("type", request.getStatus());
        data.put("read", !"pending".equals(request.getStatus()));
        data.put("createdAt", request.getUpdatedAt() != null ? request.getUpdatedAt() : request.getCreatedAt());
        return data;
    }

    private Map<String, Object> storedNotification(Notification notification) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", notification.getId());
        data.put("title", notification.getSubject());
        data.put("subject", notification.getSubject());
        data.put("message", notification.getMessage());
        data.put("detail", notification.getMessage());
        data.put("type", notification.getType() != null ? notification.getType().name().toLowerCase() : "info");
        data.put("read", notification.isRead());
        data.put("referenceId", notification.getReferenceId());
        data.put("createdAt", notification.getCreatedAt());
        return data;
    }

    private int notifyNearbyReceivers(Donation donation) {
        if (donation.getLatitude() == null || donation.getLongitude() == null) {
            return 0;
        }

        List<Notification> notifications = userRepository.findByType("receiver").stream()
            .filter(receiver -> isNearby(receiver, donation))
            .map(receiver -> Notification.builder()
                .userId(receiver.getId())
                .subject("Nearby food available")
                .message(donation.getOrganizationName() + " published " + donation.getFoodName() + " near your location.")
                .type(NotificationType.IN_APP)
                .read(false)
                .referenceId(donation.getId())
                .build())
            .toList();

        notificationRepository.saveAll(notifications);
        return notifications.size();
    }

    private boolean isNearby(User receiver, Donation donation) {
        if (receiver.getLatitude() == null || receiver.getLongitude() == null || donation.getLatitude() == null || donation.getLongitude() == null) {
            return false;
        }
        return distanceKm(receiver.getLatitude(), receiver.getLongitude(), donation.getLatitude(), donation.getLongitude()) <= nearbyRadiusKm;
    }

    private double distanceKm(double firstLatitude, double firstLongitude, double secondLatitude, double secondLongitude) {
        double earthRadiusKm = 6371.0;
        double latitudeDelta = Math.toRadians(secondLatitude - firstLatitude);
        double longitudeDelta = Math.toRadians(secondLongitude - firstLongitude);
        double firstLatRad = Math.toRadians(firstLatitude);
        double secondLatRad = Math.toRadians(secondLatitude);
        double a = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2)
            + Math.cos(firstLatRad) * Math.cos(secondLatRad) * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);
        return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private String role(Map<String, Object> payload) {
        String role = value(payload, "role");
        if ("receiver".equals(role) || "admin".equals(role)) {
            return role;
        }
        return "donor";
    }

    private void requireFields(Map<String, Object> payload, List<String> fields) {
        List<String> missing = new ArrayList<>();
        for (String field : fields) {
            if (value(payload, field).isBlank()) {
                missing.add(field);
            }
        }
        if (!missing.isEmpty()) {
            throw new BadRequestException("Missing required field: " + String.join(", ", missing));
        }
    }

    private String value(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        if (value == null) {
            return "";
        }
        String sanitized = String.valueOf(value)
            .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", "")
            .trim();
        return sanitized.length() > 2_000 ? sanitized.substring(0, 2_000) : sanitized;
    }

    private String valueOrDefault(Map<String, Object> payload, String key, String fallback) {
        String value = value(payload, key);
        return value.isBlank() ? fallback : value;
    }

    private int intValue(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            throw new BadRequestException("Quantity must be a valid number");
        }
    }

    private Double doubleValueOrNull(Object value) {
        if (value == null || String.valueOf(value).trim().isBlank()) {
            return null;
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(value).trim());
        } catch (NumberFormatException ex) {
            throw new BadRequestException("Location coordinates must be valid numbers");
        }
    }

    private Instant instant(String value) {
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException ex) {
            throw new BadRequestException("Invalid date-time value");
        }
    }

    private Map<String, Object> details(Map<String, Object> payload, List<String> keys) {
        Map<String, Object> details = new HashMap<>();
        for (String key : keys) {
            if (payload.containsKey(key)) {
                details.put(key, payload.get(key));
            }
        }
        return details;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> objectMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new HashMap<>();
            map.forEach((key, mapValue) -> result.put(String.valueOf(key), mapValue));
            return result;
        }
        return new HashMap<>();
    }

    private StoredFile storedFile(Object value) {
        Map<String, Object> map = objectMap(value);
        if (map.isEmpty()) {
            return null;
        }
        validateStoredFile(map);
        return StoredFile.builder()
            .name(String.valueOf(map.getOrDefault("name", "")))
            .type(String.valueOf(map.getOrDefault("type", "")))
            .size(map.get("size") instanceof Number number ? number.longValue() : null)
            .data(String.valueOf(map.getOrDefault("data", "")))
            .url(String.valueOf(map.getOrDefault("url", "")))
            .publicId(String.valueOf(map.getOrDefault("publicId", "")))
            .build();
    }

    private Map<String, Object> validatedDocuments(Map<String, Object> documents) {
        Map<String, Object> validated = new HashMap<>();
        documents.forEach((key, value) -> {
            Map<String, Object> file = objectMap(value);
            validateStoredFile(file);
            validated.put(key, file);
        });
        return validated;
    }

    private void validateStoredFile(Map<String, Object> file) {
        String type = String.valueOf(file.getOrDefault("type", ""));
        long size = file.get("size") instanceof Number number ? number.longValue() : 0;
        String data = String.valueOf(file.getOrDefault("data", ""));
        String url = String.valueOf(file.getOrDefault("url", ""));

        if (!List.of("application/pdf", "image/jpeg", "image/png", "image/webp", "").contains(type)) {
            throw new BadRequestException("Unsupported upload type");
        }
        if (size > 2 * 1024 * 1024) {
            throw new BadRequestException("Uploaded files must be smaller than 2 MB");
        }
        if (!data.isBlank() && !data.startsWith("data:application/pdf") && !data.startsWith("data:image/jpeg") && !data.startsWith("data:image/png") && !data.startsWith("data:image/webp")) {
            throw new BadRequestException("Unsupported upload data");
        }
        if (!url.isBlank() && !url.startsWith("https://")) {
            throw new BadRequestException("Uploaded file URLs must use HTTPS");
        }
    }

    private Map<String, Object> authResponse(String message, User user) {
        return Map.of(
            "message", message,
            "user", mapper.toPublicUser(user),
            "accessToken", jwtService.createAccessToken(user),
            "refreshToken", jwtService.createRefreshToken(user),
            "tokenType", "Bearer"
        );
    }

    private AuthenticatedUser authenticatedUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication() == null
            ? null
            : SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof AuthenticatedUser user) {
            return user;
        }
        throw new AccessDeniedException("Authentication required");
    }

    private User currentUser(UserRole requiredRole) {
        User user = currentUser();
        if (!user.getRoles().contains(requiredRole)) {
            throw new AccessDeniedException("Required role: " + requiredRole.name());
        }
        return user;
    }

    private User currentUser() {
        AuthenticatedUser principal = authenticatedUser();
        return userRepository.findById(principal.id())
            .orElseThrow(() -> new AccessDeniedException("Authenticated user no longer exists"));
    }

    private record OtpChallenge(String code, Instant expiresAt, int attempts, Instant lastSentAt) {
        OtpChallenge withAttempt() {
            return new OtpChallenge(code, expiresAt, attempts + 1, lastSentAt);
        }
    }
}
