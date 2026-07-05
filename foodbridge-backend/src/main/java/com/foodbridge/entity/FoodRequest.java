package com.foodbridge.entity;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "foodRequests")
@CompoundIndex(name = "food_receiver_unique", def = "{'foodId': 1, 'receiverId': 1}", unique = true)
public class FoodRequest {

    @Id
    private String id;

    @Indexed
    private String foodId;

    @Indexed
    private String donorId;

    @Indexed
    private String receiverId;

    private String foodName;
    private String foodType;
    private String donorOrg;
    private String receiverName;
    private String receiverOrg;
    private String receiverType;
    private String message;

    @Indexed
    @Builder.Default
    private String status = "pending";

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
