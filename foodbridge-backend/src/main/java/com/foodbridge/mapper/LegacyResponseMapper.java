package com.foodbridge.mapper;

import com.foodbridge.dto.LegacyAuthUserResponse;
import com.foodbridge.dto.LegacyDonationResponse;
import com.foodbridge.dto.LegacyFoodRequestResponse;
import com.foodbridge.entity.Donation;
import com.foodbridge.entity.FoodRequest;
import com.foodbridge.entity.User;
import org.springframework.stereotype.Component;

@Component
public class LegacyResponseMapper {

    public LegacyAuthUserResponse toPublicUser(User user) {
        return new LegacyAuthUserResponse(
            user.getId(),
            user.getType(),
            user.getEmail(),
            user.getName(),
            user.getOrganizationName(),
            user.getOrganizationType(),
            user.getPhone(),
            user.getAddress(),
            user.getCity(),
            user.getState(),
            user.getPincode(),
            user.getLatitude(),
            user.getLongitude(),
            user.getStatus() != null ? user.getStatus().name().toLowerCase() : null,
            user.getCreatedAt(),
            user.getDetails()
        );
    }

    public LegacyDonationResponse toPublicDonation(Donation donation) {
        return new LegacyDonationResponse(
            donation.getId(),
            donation.getDonorId(),
            donation.getDonorName(),
            donation.getOrganizationName(),
            donation.getFoodName(),
            donation.getFoodType(),
            donation.getQuantity(),
            donation.getUnit(),
            donation.getLocation(),
            donation.getLatitude(),
            donation.getLongitude(),
            null,
            donation.getPickupTime(),
            donation.getExpiryTime(),
            donation.getDescription(),
            donation.getImage(),
            donation.getPriority(),
            donation.getRemainingPickupWindowMinutes(),
            donation.getManualReviewRequired(),
            donation.getManualReviewReason(),
            donation.getAiAnalysis(),
            donation.getValidation(),
            donation.getLocationDetails(),
            donation.getRecommendedNgos(),
            donation.getStatus(),
            donation.getAssignedReceiverName(),
            donation.getCreatedAt()
        );
    }

    public LegacyFoodRequestResponse toPublicRequest(FoodRequest request) {
        return new LegacyFoodRequestResponse(
            request.getId(),
            request.getFoodId(),
            request.getDonorId(),
            request.getReceiverId(),
            request.getFoodName(),
            request.getFoodType(),
            request.getDonorOrg(),
            request.getReceiverName(),
            request.getReceiverOrg(),
            request.getReceiverType(),
            request.getMessage(),
            request.getStatus(),
            request.getCreatedAt()
        );
    }
}
