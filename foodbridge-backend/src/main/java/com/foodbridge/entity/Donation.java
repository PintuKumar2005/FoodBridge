package com.foodbridge.entity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "donations")
public class Donation {

    @Id
    private String id;

    @Indexed
    private String donorId;

    private String donorName;
    private String organizationName;
    private String foodName;
    private String foodType;
    private Integer quantity;
    private String unit;
    private String location;
    private Double latitude;
    private Double longitude;
    private Instant pickupTime;
    private Instant expiryTime;
    private String description;
    private StoredFile image;
    private String priority;
    private Long remainingPickupWindowMinutes;
    private Boolean manualReviewRequired;
    private String manualReviewReason;

    @Builder.Default
    private Map<String, Object> aiAnalysis = new HashMap<>();

    @Builder.Default
    private Map<String, Object> validation = new HashMap<>();

    @Builder.Default
    private Map<String, Object> locationDetails = new HashMap<>();

    @Builder.Default
    private List<Map<String, Object>> recommendedNgos = new ArrayList<>();

    @Indexed
    @Builder.Default
    private String status = "available";

    private String assignedReceiverId;
    private String assignedReceiverName;
    private String assignedVolunteerId;
    private String assignedVolunteerName;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
