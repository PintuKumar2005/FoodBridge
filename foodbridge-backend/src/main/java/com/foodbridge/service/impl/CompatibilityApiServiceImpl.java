package com.foodbridge.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.foodbridge.dto.LegacyDonationResponse;
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
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
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
    private final ObjectMapper objectMapper;
    private final Map<String, OtpChallenge> otps = new ConcurrentHashMap<>();
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${app.matching.nearby-radius-km:10}")
    private double nearbyRadiusKm;

    @Value("${app.admin.phone:6206758647}")
    private String adminPhone;

    @Value("${app.ai.openai.api-key:}")
    private String openAiApiKey;

    @Value("${app.ai.openai.model:gpt-4.1-mini}")
    private String openAiVisionModel;

    @Value("${app.ai.openai.endpoint:https://api.openai.com/v1/responses}")
    private String openAiResponsesEndpoint;

    @Value("${app.ai.openai.timeout-seconds:25}")
    private int openAiTimeoutSeconds;

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
            .details(details(payload, List.of("fssaiLicenseNumber", "businessRegistrationNumber", "foodType", "averageDailySurplus", "pickupAvailability")))
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
        Map<String, Object> documents = validatedDocuments(objectMap(payload.get("documents")));

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
            .details(details(payload, List.of("registrationNumber", "numberOfResidents", "foodPreference", "canArrangePickup")))
            .documents(documents)
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

        if ("admin".equals(role)) {
            ensureAdminUser(phone);
        } else {
            userRepository.findByTypeAndPhone(role, phone)
                .orElseThrow(() -> new ResourceNotFoundException("No " + role + " found for this phone number"));
        }

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

        User user = "admin".equals(role)
            ? ensureAdminUser(phone)
            : userRepository.findByTypeAndPhone(role, phone)
                .orElseThrow(() -> new ResourceNotFoundException("No " + role + " found for this phone number"));
        otps.remove(key);
        return authResponse("Login successful", user);
    }

    @Override
    public Map<String, Object> createDonation(Map<String, Object> payload) {
        requireFields(payload, List.of("foodName", "foodType", "quantity", "location"));
        String preparationTimeValue = valueOrDefault(payload, "preparationTime", value(payload, "expiryTime"));
        if (preparationTimeValue.isBlank()) {
            throw new BadRequestException("Missing required field: preparationTime");
        }

        User donor = currentUser(UserRole.DONOR);

        int quantity = intValue(payload.get("quantity"));
        if (quantity < 1) {
            throw new BadRequestException("Quantity must be at least 1");
        }

        Instant preparationTime = instant(preparationTimeValue);
        Instant donationTime = Instant.now();

        Double donationLatitude = donor.getLatitude();
        Double donationLongitude = donor.getLongitude();
        if (donationLatitude == null) {
            donationLatitude = doubleValueOrNull(payload.get("latitude"));
        }
        if (donationLongitude == null) {
            donationLongitude = doubleValueOrNull(payload.get("longitude"));
        }
        StoredFile foodImage = storedFile(payload.get("image"));
        Map<String, Object> aiAnalysis = analyzeFoodImage(payload, foodImage);
        Map<String, Object> validation = validateDonationDetails(payload, aiAnalysis);
        Map<String, Object> qualityCheck = qualityCheck(payload, aiAnalysis, donationTime);
        validation.put("qualityCheck", qualityCheck);
        if (!Boolean.TRUE.equals(qualityCheck.get("canPost"))) {
            throw new BadRequestException(String.valueOf(qualityCheck.getOrDefault("message", "Food quality check failed. Donation was not posted.")));
        }
        Instant pickupTime = value(payload, "pickupTime").isBlank() ? donationTime.plus(Duration.ofHours(1)) : instant(value(payload, "pickupTime"));
        long remainingPickupWindowMinutes = Math.max(0, (pickupTime.toEpochMilli() - donationTime.toEpochMilli()) / 60_000);
        String priority = priorityForRemainingMinutes(remainingPickupWindowMinutes);
        Map<String, Object> locationDetails = donationLocationDetails(payload, donationLatitude, donationLongitude);
        List<Map<String, Object>> recommendedNgos = recommendedNgos(donationLatitude, donationLongitude, value(payload, "foodType"), intValue(payload.get("quantity")), valueOrDefault(payload, "unit", "Meals"));

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
            .pickupTime(pickupTime)
            .expiryTime(preparationTime)
            .description(valueOrDefault(payload, "description", ""))
            .image(foodImage)
            .priority(priority)
            .remainingPickupWindowMinutes(remainingPickupWindowMinutes)
            .manualReviewRequired(Boolean.TRUE.equals(validation.get("manualReviewRequired")))
            .manualReviewReason(String.valueOf(validation.getOrDefault("manualReviewReason", "")))
            .aiAnalysis(aiAnalysis)
            .validation(validation)
            .locationDetails(locationDetails)
            .recommendedNgos(recommendedNgos)
            .status("available")
            .assignedReceiverName("")
            .build();

        donation = donationRepository.save(donation);
        int notifiedReceivers = notifyRecommendedReceivers(donation);
        return Map.of("message", "Food donation published", "donation", mapper.toPublicDonation(donation), "notifiedReceivers", notifiedReceivers);
    }

    @Override
    public Map<String, Object> analyzeDonationImage(Map<String, Object> payload) {
        currentUser(UserRole.DONOR);
        Map<String, Object> previewPayload = payload == null ? new HashMap<>() : new HashMap<>(payload);
        if (value(previewPayload, "quantity").isBlank()) {
            previewPayload.put("quantity", 1);
        }
        if (value(previewPayload, "unit").isBlank()) {
            previewPayload.put("unit", "Meals");
        }

        Map<String, Object> analysis;
        try {
            StoredFile foodImage = storedFile(previewPayload.get("image"));
            analysis = analyzeFoodImage(previewPayload, foodImage);
        } catch (RuntimeException ex) {
            analysis = fallbackFoodAnalysis(previewPayload, "AI preview could not be completed: " + ex.getMessage(), true);
        }
        Map<String, Object> validation;
        try {
            validation = validateDonationDetails(previewPayload, analysis);
        } catch (RuntimeException ex) {
            validation = Map.of(
                "checkedFields", List.of("foodName", "category", "quantity", "estimatedServings", "description", "image"),
                "mismatches", List.of("Preview validation could not be completed"),
                "manualReviewRequired", true,
                "manualReviewReason", ex.getMessage() == null ? "Preview validation could not be completed" : ex.getMessage()
            );
        }
        Map<String, Object> qualityCheck = qualityCheck(previewPayload, analysis, Instant.now());
        return Map.of(
            "message", "AI analysis completed",
            "aiAnalysis", analysis,
            "validation", validation,
            "qualityCheck", qualityCheck
        );
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
            List<LegacyDonationResponse> nearbyDonations = donationRepository.findByStatusInOrderByCreatedAtDesc(List.of("available", "requested")).stream()
                .filter(donation -> isNearby(receiver, donation))
                .map(donation -> withDistance(mapper.toPublicDonation(donation), distanceKm(receiver.getLatitude(), receiver.getLongitude(), donation.getLatitude(), donation.getLongitude())))
                .toList();
            return Map.of("donations", nearbyDonations);
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
    public Map<String, Object> updateProfile(Map<String, Object> payload) {
        User user = currentUser();

        if (payload.containsKey("name")) {
            String name = value(payload, "name");
            if (name.isBlank()) {
                throw new BadRequestException("Name is required");
            }
            user.setName(name);
        }
        if (payload.containsKey("organizationName")) {
            String organizationName = value(payload, "organizationName");
            if (organizationName.isBlank()) {
                throw new BadRequestException("Organization name is required");
            }
            user.setOrganizationName(organizationName);
        }
        if (payload.containsKey("organizationType")) {
            String organizationType = value(payload, "organizationType");
            if (organizationType.isBlank()) {
                throw new BadRequestException("Organization type is required");
            }
            user.setOrganizationType(organizationType);
        }
        if (payload.containsKey("email")) {
            String email = value(payload, "email").toLowerCase();
            if (!email.matches("^\\S+@\\S+\\.\\S+$")) {
                throw new BadRequestException("Enter a valid email address");
            }
            user.setEmail(email);
        }
        if (payload.containsKey("phone")) {
            String phone = PhoneNumberUtils.normalizeIndianMobile(value(payload, "phone"));
            if (!phone.matches("\\d{10}")) {
                throw new BadRequestException("Enter a valid 10-digit mobile number");
            }
            if (!phone.equals(user.getPhone()) && userRepository.existsByTypeAndPhone(user.getType(), phone)) {
                throw new ConflictException("An account with this phone number already exists");
            }
            user.setPhone(phone);
        }

        updateAddressField(payload, "address", user::setAddress, true);
        updateAddressField(payload, "city", user::setCity, true);
        updateAddressField(payload, "state", user::setState, true);
        if (payload.containsKey("pincode")) {
            String pincode = value(payload, "pincode");
            if (!pincode.matches("\\d{6}")) {
                throw new BadRequestException("Enter a valid 6-digit pincode");
            }
            user.setPincode(pincode);
        }

        if (payload.containsKey("latitude")) {
            user.setLatitude(doubleValueOrNull(payload.get("latitude")));
        }
        if (payload.containsKey("longitude")) {
            user.setLongitude(doubleValueOrNull(payload.get("longitude")));
        }
        if (payload.containsKey("documents")) {
            Map<String, Object> documents = new HashMap<>(user.getDocuments() == null ? Map.of() : user.getDocuments());
            documents.putAll(validatedDocuments(objectMap(payload.get("documents"))));
            user.setDocuments(documents);
        }

        user = userRepository.save(user);
        return Map.of("message", "Profile updated", "profile", profile(user));
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

    private Map<String, Object> analyzeFoodImage(Map<String, Object> payload, StoredFile image) {
        if (image == null) {
            return fallbackFoodAnalysis(payload, "Image is missing or insufficient for visual assessment.", false);
        }
        String imageUrl = aiImageUrl(image);
        if (imageUrl.isBlank()) {
            return fallbackFoodAnalysis(payload, "Uploaded file is not a supported image for AI analysis.", false);
        }
        if (openAiApiKey == null || openAiApiKey.isBlank()) {
            return fallbackFoodAnalysis(payload, "AI image analysis is not configured. Set OPENAI_API_KEY on the backend server.", false);
        }

        try {
            Map<String, Object> requestPayload = new LinkedHashMap<>();
            requestPayload.put("model", openAiVisionModel);
            requestPayload.put("temperature", 0);
            requestPayload.put("input", List.of(Map.of(
                "role", "user",
                "content", List.of(
                    Map.of("type", "input_text", "text", foodAnalysisPrompt(payload)),
                    Map.of("type", "input_image", "image_url", imageUrl, "detail", "high")
                )
            )));

            HttpRequest request = HttpRequest.newBuilder(URI.create(openAiResponsesEndpoint))
                .timeout(Duration.ofSeconds(openAiTimeoutSeconds))
                .header("Authorization", "Bearer " + openAiApiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestPayload)))
                .build();

            HttpResponse<String> response = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(Math.min(openAiTimeoutSeconds, 10)))
                .build()
                .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return fallbackFoodAnalysis(payload, "AI image analysis failed with status " + response.statusCode() + ".", true);
            }

            String outputText = extractOpenAiOutputText(response.body());
            Map<String, Object> analysis = parseAiAnalysis(outputText);
            return normalizeAiAnalysis(payload, analysis);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return fallbackFoodAnalysis(payload, "AI image analysis was interrupted.", true);
        } catch (IOException | IllegalArgumentException ex) {
            return fallbackFoodAnalysis(payload, "AI image analysis could not be completed: " + ex.getMessage(), true);
        }
    }

    private String foodAnalysisPrompt(Map<String, Object> payload) {
        return """
            Analyze the uploaded food donation image using only visible appearance.
            Return only valid JSON, with no markdown and no extra text.
            Do not claim the food is definitely safe to eat.
            If the image is insufficient to determine food safety, clearly state that the assessment is based only on visible appearance.

            Donor input:
            Food Name: %s
            Category: %s
            Quantity: %s %s
            Packaging: %s
            Description: %s

            Required JSON keys:
            foodType, category, estimatedServings, freshness, packaging, visibleDamage, mold, leakage, burnMarks,
            contaminationSigns, colorChanges, dryness, spoilage, visibleIssues, confidence, assessmentBasis.

            category must be one of: Veg, Non-Veg, Both, Unknown.
            visibleIssues must be an array of short strings.
            confidence must be a number from 0 to 100.
            """.formatted(
                value(payload, "foodName"),
                value(payload, "foodType"),
                value(payload, "quantity"),
                valueOrDefault(payload, "unit", "Meals"),
                valueOrDefault(payload, "packaging", "Covered"),
                value(payload, "description")
            );
    }

    private String aiImageUrl(StoredFile image) {
        if (image.getUrl() != null && !image.getUrl().isBlank()) {
            return image.getUrl();
        }
        if (image.getData() != null && image.getData().startsWith("data:image/")) {
            return image.getData();
        }
        return "";
    }

    private String extractOpenAiOutputText(String responseBody) throws JsonProcessingException {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode outputText = root.get("output_text");
        if (outputText != null && outputText.isTextual()) {
            return outputText.asText();
        }
        for (JsonNode output : root.path("output")) {
            for (JsonNode content : output.path("content")) {
                JsonNode text = content.get("text");
                if (text != null && text.isTextual()) {
                    return text.asText();
                }
            }
        }
        throw new IllegalArgumentException("No JSON text was returned by the AI provider.");
    }

    private Map<String, Object> parseAiAnalysis(String outputText) throws JsonProcessingException {
        String json = outputText.trim();
        int start = json.indexOf('{');
        int end = json.lastIndexOf('}');
        if (start >= 0 && end > start) {
            json = json.substring(start, end + 1);
        }
        return objectMapper.readValue(json, new TypeReference<>() {});
    }

    private Map<String, Object> normalizeAiAnalysis(Map<String, Object> payload, Map<String, Object> rawAnalysis) {
        Map<String, Object> analysis = new LinkedHashMap<>();
        analysis.put("foodType", stringOrFallback(rawAnalysis.get("foodType"), value(payload, "foodName")));
        analysis.put("category", normalizedCategory(stringOrFallback(rawAnalysis.get("category"), value(payload, "foodType"))));
        analysis.put("estimatedServings", positiveIntOrFallback(rawAnalysis.get("estimatedServings"), estimateServings(intValue(payload.get("quantity")), valueOrDefault(payload, "unit", "Meals"))));
        analysis.put("freshness", stringOrFallback(rawAnalysis.get("freshness"), "Cannot determine from image"));
        analysis.put("packaging", stringOrFallback(rawAnalysis.get("packaging"), "Cannot determine from image"));
        analysis.put("visibleDamage", stringOrFallback(rawAnalysis.get("visibleDamage"), "Not confirmed"));
        analysis.put("mold", stringOrFallback(rawAnalysis.get("mold"), "Not confirmed"));
        analysis.put("leakage", stringOrFallback(rawAnalysis.get("leakage"), "Not confirmed"));
        analysis.put("burnMarks", stringOrFallback(rawAnalysis.get("burnMarks"), "Not confirmed"));
        analysis.put("contaminationSigns", stringOrFallback(rawAnalysis.get("contaminationSigns"), "Not confirmed"));
        analysis.put("colorChanges", stringOrFallback(rawAnalysis.get("colorChanges"), "Not confirmed"));
        analysis.put("dryness", stringOrFallback(rawAnalysis.get("dryness"), "Not confirmed"));
        analysis.put("spoilage", stringOrFallback(rawAnalysis.get("spoilage"), "Not confirmed"));
        analysis.put("visibleIssues", stringList(rawAnalysis.get("visibleIssues")));
        analysis.put("confidence", boundedConfidence(rawAnalysis.get("confidence")));
        analysis.put("assessmentBasis", stringOrFallback(rawAnalysis.get("assessmentBasis"), "Assessment is based only on visible appearance. This does not confirm the food is safe to eat."));
        analysis.put("aiProvider", "openai");
        analysis.put("aiModel", openAiVisionModel);
        return analysis;
    }

    private Map<String, Object> fallbackFoodAnalysis(Map<String, Object> payload, String reason, boolean aiAttempted) {
        Map<String, Object> analysis = new LinkedHashMap<>();
        int estimatedServings = estimateServings(positiveIntOrFallback(payload.get("quantity"), 1), valueOrDefault(payload, "unit", "Meals"));
        List<String> visibleIssues = new ArrayList<>();
        visibleIssues.add("insufficient_image");

        analysis.put("foodType", value(payload, "foodName"));
        analysis.put("category", value(payload, "foodType"));
        analysis.put("estimatedServings", estimatedServings);
        analysis.put("freshness", "Cannot determine from image");
        analysis.put("packaging", "Cannot determine from image");
        analysis.put("visibleDamage", "Not confirmed");
        analysis.put("mold", "Not confirmed");
        analysis.put("leakage", "Not confirmed");
        analysis.put("burnMarks", "Not confirmed");
        analysis.put("contaminationSigns", "Not confirmed");
        analysis.put("colorChanges", "Not confirmed");
        analysis.put("dryness", "Not confirmed");
        analysis.put("spoilage", "Not confirmed");
        analysis.put("visibleIssues", visibleIssues);
        analysis.put("confidence", 25);
        analysis.put("assessmentBasis", "Assessment is based only on submitted metadata because AI image analysis was unavailable. This does not confirm the food is safe to eat.");
        analysis.put("aiProvider", "openai");
        analysis.put("aiAttempted", aiAttempted);
        analysis.put("aiUnavailableReason", reason);
        return analysis;
    }

    private String stringOrFallback(Object value, String fallback) {
        String text = value == null ? "" : String.valueOf(value).trim();
        return text.isBlank() ? fallback : text;
    }

    private String normalizedCategory(String category) {
        if ("Veg".equalsIgnoreCase(category)) {
            return "Veg";
        }
        if ("Non-Veg".equalsIgnoreCase(category) || "Non Veg".equalsIgnoreCase(category) || "NonVegetarian".equalsIgnoreCase(category)) {
            return "Non-Veg";
        }
        if ("Both".equalsIgnoreCase(category)) {
            return "Both";
        }
        return "Unknown";
    }

    private int positiveIntOrFallback(Object value, int fallback) {
        if (value instanceof Number number && number.intValue() > 0) {
            return number.intValue();
        }
        try {
            int parsed = Integer.parseInt(String.valueOf(value));
            return parsed > 0 ? parsed : fallback;
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private int boundedConfidence(Object value) {
        int confidence = positiveIntOrFallback(value, 50);
        return Math.max(0, Math.min(100, confidence));
    }

    private List<String> stringList(Object value) {
        if (value instanceof List<?> list) {
            return list.stream()
                .map(String::valueOf)
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .toList();
        }
        String text = value == null ? "" : String.valueOf(value).trim();
        return text.isBlank() ? new ArrayList<>() : new ArrayList<>(List.of(text));
    }

    private Map<String, Object> qualityCheck(Map<String, Object> payload, Map<String, Object> analysis, Instant donationTime) {
        List<Map<String, Object>> requirements = new ArrayList<>();
        ScorePart timeScore = timeSafetyScore(payload, donationTime);
        ScorePart foodTypeScore = foodTypeSafetyScore(payload, timeScore.ageMinutes());
        ScorePart packagingScore = packagingSafetyScore(payload, analysis);
        ScorePart imageScore = imageSafetyScore(analysis);
        requirements.add(requirement("Time since preparation", timeScore.passed(), timeScore.score(), timeScore.reason()));
        requirements.add(requirement("Food type", foodTypeScore.passed(), foodTypeScore.score(), foodTypeScore.reason()));
        requirements.add(requirement("Packaging", packagingScore.passed(), packagingScore.score(), packagingScore.reason()));
        requirements.add(requirement("Image analysis", imageScore.passed(), imageScore.score(), imageScore.reason()));

        int safetyScore = Math.max(0, Math.min(100, timeScore.score() + foodTypeScore.score() + packagingScore.score() + imageScore.score()));
        boolean forcedUnsafe = timeScore.forceUnsafe() || foodTypeScore.forceUnsafe() || packagingScore.forceUnsafe() || imageScore.forceUnsafe();
        if (isYes(value(payload, "refrigeratorUsed")) && !imageScore.forceUnsafe()) {
            if (timeScore.ageMinutes() <= 1_440) {
                safetyScore = Math.max(95, safetyScore);
            } else if (timeScore.ageMinutes() <= 2_880) {
                safetyScore = Math.max(70, Math.min(94, safetyScore));
            } else {
                safetyScore = Math.min(69, safetyScore);
            }
        }
        String safetyResult = forcedUnsafe || safetyScore < 60 ? "UNSAFE" : safetyScore >= 85 ? "SAFE" : "DONATE_IMMEDIATELY";
        boolean canPost = !"UNSAFE".equals(safetyResult);
        String resultMessage = switch (safetyResult) {
            case "SAFE" -> "Food appears fresh and suitable for donation.";
            case "DONATE_IMMEDIATELY" -> "Food should be picked up within the next hour.";
            default -> "Food is not suitable for donation.";
        };
        Map<String, Object> quality = new LinkedHashMap<>();
        quality.put("requirements", requirements);
        quality.put("passPercentage", safetyScore);
        quality.put("safetyScore", safetyScore);
        quality.put("result", safetyResult);
        quality.put("resultLabel", switch (safetyResult) {
            case "SAFE" -> "Safe to Donate";
            case "DONATE_IMMEDIATELY" -> "Donate Immediately";
            default -> "Not Recommended";
        });
        quality.put("canPost", canPost);
        quality.put("message", resultMessage);
        return quality;
    }

    private ScorePart timeSafetyScore(Map<String, Object> payload, Instant donationTime) {
        String preparationTimeValue = valueOrDefault(payload, "preparationTime", value(payload, "expiryTime"));
        if (preparationTimeValue.isBlank()) {
            return new ScorePart(0, false, true, Long.MAX_VALUE, "Preparation time is required.");
        }
        try {
            Instant preparationTime = instant(preparationTimeValue);
            long ageMinutes = Duration.between(preparationTime, donationTime).toMinutes();
            if (ageMinutes < 0) {
                return new ScorePart(0, false, true, ageMinutes, "Preparation time cannot be after donation time.");
            }
            long hours = ageMinutes / 60;
            long minutes = ageMinutes % 60;
            String ageText = "Prepared " + hours + " hr " + minutes + " min before donation.";
            if (isYes(value(payload, "refrigeratorUsed"))) {
                if (ageMinutes <= 1_440) {
                    return new ScorePart(50, true, false, ageMinutes, "Refrigerator used. 0-24 hours: Safe to Donate. " + ageText);
                }
                if (ageMinutes <= 2_880) {
                    return new ScorePart(35, true, false, ageMinutes, "Refrigerator used. 24-48 hours: Donate Immediately. " + ageText);
                }
                return new ScorePart(0, false, true, ageMinutes, "Refrigerator used, but preparation time is more than 48 hours. Not recommended.");
            }
            if (ageMinutes < 120) {
                return new ScorePart(50, true, false, ageMinutes, "Excellent. " + ageText);
            }
            if (ageMinutes <= 240) {
                return new ScorePart(35, true, false, ageMinutes, "Good. Immediate donation recommended. " + ageText);
            }
            return new ScorePart(0, false, true, ageMinutes, "More than 4 hours since preparation. Unsafe for donation.");
        } catch (RuntimeException ex) {
            return new ScorePart(0, false, true, Long.MAX_VALUE, "Preparation time is invalid.");
        }
    }

    private boolean isYes(String value) {
        return "yes".equalsIgnoreCase(value) || "true".equalsIgnoreCase(value) || "1".equals(value);
    }

    private ScorePart foodTypeSafetyScore(Map<String, Object> payload, long ageMinutes) {
        String foodType = value(payload, "foodType");
        String foodName = value(payload, "foodName");
        boolean nonVeg = "Non-Veg".equalsIgnoreCase(foodType) || containsAny(foodName, "chicken", "fish", "egg", "omelette", "prawn", "seafood", "mutton");
        boolean highRisk = containsAny(foodName, "chicken", "fish", "egg", "omelette", "prawn", "seafood");
        if (!nonVeg) {
            return new ScorePart(10, true, false, ageMinutes, "Vegetarian food has a slightly longer acceptable donation window under proper storage.");
        }
        if (highRisk && ageMinutes > 120) {
            return new ScorePart(2, false, false, ageMinutes, "Chicken, fish, eggs, and seafood require stricter evaluation after 2 hours.");
        }
        return new ScorePart(6, true, false, ageMinutes, "Non-vegetarian food requires stricter handling and faster pickup.");
    }

    private ScorePart packagingSafetyScore(Map<String, Object> payload, Map<String, Object> analysis) {
        String packaging = valueOrDefault(payload, "packaging", stringOrFallback(analysis.get("packaging"), "Covered"));
        if (containsAny(packaging, "sealed", "packed", "airtight")) {
            return new ScorePart(20, true, false, 0, "Sealed packaging is best.");
        }
        if (containsAny(packaging, "covered", "container", "box")) {
            return new ScorePart(14, true, false, 0, "Covered packaging is acceptable.");
        }
        if (containsAny(packaging, "open")) {
            return new ScorePart(5, false, false, 0, "Open packaging reduces the safety score.");
        }
        return new ScorePart(10, true, false, 0, "Packaging was unclear, so a partial score was applied.");
    }

    private ScorePart imageSafetyScore(Map<String, Object> analysis) {
        if (analysis.containsKey("aiUnavailableReason")) {
            return new ScorePart(10, true, false, 0, "No usable AI image analysis. Partial score applied because image is optional.");
        }
        if (containsAny(analysis.get("mold"), "yes", "visible", "detected", "present")
            || containsAny(analysis.get("spoilage"), "yes", "visible", "detected", "present", "spoiled", "rotten")
            || containsAny(analysis.get("colorChanges"), "yes", "visible", "detected", "present", "discolor")
            || containsAny(analysis.get("leakage"), "yes", "visible", "detected", "present")
            || containsAny(analysis.get("visibleIssues"), "mold", "spoilage", "rotten", "leakage", "contamination")) {
            return new ScorePart(0, false, true, 0, "Spoilage, mold, color change, or leakage was detected in the image.");
        }
        if (containsAny(analysis.get("dryness"), "yes", "visible", "detected", "dry")) {
            return new ScorePart(12, true, false, 0, "Dryness was visible, so image score was reduced.");
        }
        return new ScorePart(20, true, false, 0, "No visible mold, color change, dryness, spoilage, or leakage detected.");
    }

    private record ScorePart(int score, boolean passed, boolean forceUnsafe, long ageMinutes, String reason) {
    }

    private Map<String, Object> requirement(String name, boolean passed, int percent, String reason) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("name", name);
        data.put("passed", passed);
        data.put("percent", passed ? Math.max(0, Math.min(100, percent)) : 0);
        data.put("reason", passed ? "Passed" : reason);
        return data;
    }

    private boolean containsAny(Object value, String... needles) {
        String text;
        if (value instanceof List<?> list) {
            text = String.join(" ", list.stream().map(String::valueOf).toList());
        } else {
            text = value == null ? "" : String.valueOf(value);
        }
        String normalized = text.toLowerCase();
        for (String needle : needles) {
            if (normalized.contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private int numberValue(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private Map<String, Object> validateDonationDetails(Map<String, Object> payload, Map<String, Object> analysis) {
        Map<String, Object> validation = new LinkedHashMap<>();
        List<String> mismatches = new ArrayList<>();
        String donorFoodName = value(payload, "foodName");
        String donorCategory = value(payload, "foodType");
        int donorQuantity = positiveIntOrFallback(payload.get("quantity"), 1);
        int estimatedServings = analysis.get("estimatedServings") instanceof Number number ? number.intValue() : donorQuantity;

        if (donorFoodName.isBlank()) {
            mismatches.add("Food name is missing");
        }
        if (!String.valueOf(analysis.getOrDefault("category", "")).equalsIgnoreCase(donorCategory)) {
            mismatches.add("Food category does not match image analysis");
        }
        if (Math.abs(estimatedServings - donorQuantity) > Math.max(10, Math.round(donorQuantity * 0.35f))) {
            mismatches.add("Quantity differs significantly from estimated servings");
        }
        if (value(payload, "description").isBlank()) {
            mismatches.add("Description is missing");
        }
        if (objectMap(payload.get("image")).isEmpty()) {
            mismatches.add("Image is missing or insufficient for visual assessment");
        }

        validation.put("checkedFields", List.of("foodName", "category", "quantity", "estimatedServings", "description", "image"));
        validation.put("mismatches", mismatches);
        validation.put("manualReviewRequired", !mismatches.isEmpty());
        validation.put("manualReviewReason", mismatches.isEmpty() ? "" : String.join("; ", mismatches));
        return validation;
    }

    private int estimateServings(int quantity, String unit) {
        return switch (unit.toLowerCase()) {
            case "kg" -> Math.max(1, quantity * 4);
            case "boxes", "packs" -> Math.max(1, quantity * 5);
            default -> Math.max(1, quantity);
        };
    }

    private String priorityForRemainingMinutes(long minutes) {
        if (minutes < 60) {
            return "CRITICAL";
        }
        if (minutes <= 300) {
            return "HIGH";
        }
        if (minutes <= 720) {
            return "MEDIUM";
        }
        return "NORMAL";
    }

    private Map<String, Object> donationLocationDetails(Map<String, Object> payload, Double latitude, Double longitude) {
        Map<String, Object> location = new LinkedHashMap<>();
        location.put("latitude", latitude);
        location.put("longitude", longitude);
        location.put("address", value(payload, "location"));
        location.put("area", value(payload, "area"));
        location.put("locality", value(payload, "locality"));
        location.put("city", value(payload, "city"));
        location.put("district", value(payload, "city"));
        location.put("state", value(payload, "state"));
        location.put("pincode", value(payload, "pincode"));
        return location;
    }

    private List<Map<String, Object>> recommendedNgos(Double latitude, Double longitude, String foodType, int quantity, String unit) {
        if (latitude == null || longitude == null) {
            return List.of();
        }
        return userRepository.findByType("receiver").stream()
            .filter(receiver -> receiver.getLatitude() != null && receiver.getLongitude() != null)
            .map(receiver -> recommendation(receiver, latitude, longitude, foodType, quantity, unit))
            .filter(recommendation -> ((Number) recommendation.get("distanceKm")).doubleValue() <= nearbyRadiusKm)
            .sorted(Comparator.comparingDouble(recommendation -> -((Number) recommendation.get("score")).doubleValue()))
            .limit(5)
            .toList();
    }

    private Map<String, Object> recommendation(User receiver, double latitude, double longitude, String foodType, int quantity, String unit) {
        double distanceKm = distanceKm(latitude, longitude, receiver.getLatitude(), receiver.getLongitude());
        Map<String, Object> details = receiver.getDetails() == null ? Map.of() : receiver.getDetails();
        String preference = String.valueOf(details.getOrDefault("foodPreference", "Both"));
        boolean typeAccepted = "Both".equalsIgnoreCase(preference) || "Both".equalsIgnoreCase(foodType) || preference.equalsIgnoreCase(foodType);
        boolean active = receiver.getStatus() == UserStatus.ACTIVE;
        boolean canArrangePickup = "Yes".equalsIgnoreCase(String.valueOf(details.getOrDefault("canArrangePickup", "")));
        int capacity = numberFromDetails(details.get("numberOfResidents"));
        double acceptanceRate = acceptanceRate(receiver.getId());
        double score = 100
            - Math.min(distanceKm * 5, 45)
            + (active ? 15 : -30)
            + (typeAccepted ? 15 : -25)
            + (canArrangePickup ? 8 : 0)
            + Math.min(capacity / 20.0, 10)
            + acceptanceRate * 10;

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("ngoId", receiver.getId());
        data.put("ngoName", receiver.getOrganizationName());
        data.put("distanceKm", Math.round(distanceKm * 10.0) / 10.0);
        data.put("estimatedArrivalTime", estimatedArrivalTime(distanceKm));
        data.put("operatingStatus", active ? "ACTIVE" : String.valueOf(receiver.getStatus()));
        data.put("foodTypeAccepted", typeAccepted);
        data.put("storageCapacity", capacity);
        data.put("currentAvailability", active ? "Available" : "Limited");
        data.put("previousAcceptanceRate", Math.round(acceptanceRate * 100));
        data.put("score", Math.round(score * 10.0) / 10.0);
        data.put("reason", recommendationReason(distanceKm, typeAccepted, canArrangePickup, capacity, quantity, unit));
        return data;
    }

    private int numberFromDetails(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private double acceptanceRate(String receiverId) {
        List<FoodRequest> requests = foodRequestRepository.findByReceiverIdOrderByCreatedAtDesc(receiverId);
        if (requests.isEmpty()) {
            return 0.5;
        }
        long accepted = requests.stream().filter(request -> List.of("approved", "collected").contains(request.getStatus())).count();
        return accepted / (double) requests.size();
    }

    private String estimatedArrivalTime(double distanceKm) {
        int minutes = Math.max(10, (int) Math.round(distanceKm * 4));
        return minutes < 60 ? minutes + " min" : (minutes / 60) + " hr " + (minutes % 60) + " min";
    }

    private String recommendationReason(double distanceKm, boolean typeAccepted, boolean canArrangePickup, int capacity, int quantity, String unit) {
        List<String> reasons = new ArrayList<>();
        reasons.add("Within " + (Math.round(distanceKm * 10.0) / 10.0) + " km");
        if (typeAccepted) {
            reasons.add("accepts this food type");
        }
        if (canArrangePickup) {
            reasons.add("can arrange pickup");
        }
        if (capacity >= estimateServings(quantity, unit)) {
            reasons.add("capacity appears sufficient");
        }
        return String.join(", ", reasons);
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

    private int notifyRecommendedReceivers(Donation donation) {
        if (donation.getRecommendedNgos() == null || donation.getRecommendedNgos().isEmpty()) {
            return 0;
        }

        List<Notification> notifications = donation.getRecommendedNgos().stream()
            .map(recommendation -> Notification.builder()
                .userId(String.valueOf(recommendation.get("ngoId")))
                .subject("New food donation available")
                .message(notificationMessage(donation, recommendation))
                .type(NotificationType.IN_APP)
                .read(false)
                .referenceId(donation.getId())
                .build())
            .toList();

        notificationRepository.saveAll(notifications);
        return notifications.size();
    }

    private String notificationMessage(Donation donation, Map<String, Object> recommendation) {
        return "Food: " + donation.getFoodName()
            + "\nQuantity: " + donation.getQuantity() + " " + donation.getUnit()
            + "\nDistance: " + recommendation.get("distanceKm") + " km"
            + "\nPriority: " + donation.getPriority()
            + "\nPickup Before: " + donation.getPickupTime()
            + "\nTap to accept. If this NGO declines or does not respond, the next recommended NGO can be notified.";
    }

    private LegacyDonationResponse withDistance(LegacyDonationResponse donation, double distanceKm) {
        return new LegacyDonationResponse(
            donation.id(),
            donation.donorId(),
            donation.donorName(),
            donation.organizationName(),
            donation.foodName(),
            donation.foodType(),
            donation.quantity(),
            donation.unit(),
            donation.location(),
            donation.latitude(),
            donation.longitude(),
            Math.round(distanceKm * 10.0) / 10.0,
            donation.pickupTime(),
            donation.expiryTime(),
            donation.description(),
            donation.image(),
            donation.priority(),
            donation.remainingPickupWindowMinutes(),
            donation.manualReviewRequired(),
            donation.manualReviewReason(),
            donation.aiAnalysis(),
            donation.validation(),
            donation.locationDetails(),
            donation.recommendedNgos(),
            donation.status(),
            donation.assignedReceiverName(),
            donation.createdAt()
        );
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

    private User ensureAdminUser(String phone) {
        String configuredAdminPhone = PhoneNumberUtils.normalizeIndianMobile(adminPhone);
        if (!configuredAdminPhone.equals(phone)) {
            throw new ResourceNotFoundException("No admin found for this phone number");
        }

        return userRepository.findByTypeAndPhone("admin", configuredAdminPhone)
            .map(admin -> {
                boolean changed = false;
                if (!admin.getRoles().contains(UserRole.ADMIN)) {
                    admin.getRoles().add(UserRole.ADMIN);
                    changed = true;
                }
                if (admin.getStatus() != UserStatus.ACTIVE) {
                    admin.setStatus(UserStatus.ACTIVE);
                    changed = true;
                }
                return changed ? userRepository.save(admin) : admin;
            })
            .orElseGet(() -> userRepository.save(User.builder()
                .type("admin")
                .roles(new HashSet<>(Set.of(UserRole.ADMIN)))
                .email("admin@foodbridge.local")
                .phone(configuredAdminPhone)
                .name("Admin")
                .organizationName("FoodBridge Admin")
                .organizationType("Admin")
                .status(UserStatus.ACTIVE)
                .build()));
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

    private void updateAddressField(Map<String, Object> payload, String key, Consumer<String> setter, boolean required) {
        if (!payload.containsKey(key)) {
            return;
        }
        String fieldValue = value(payload, key);
        if (required && fieldValue.isBlank()) {
            throw new BadRequestException("Missing required field: " + key);
        }
        setter.accept(fieldValue);
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
