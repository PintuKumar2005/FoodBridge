package com.foodbridge.repository;

import com.foodbridge.entity.FoodRequest;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface FoodRequestRepository extends MongoRepository<FoodRequest, String> {

    List<FoodRequest> findByDonorIdOrderByCreatedAtDesc(String donorId);

    List<FoodRequest> findByReceiverIdOrderByCreatedAtDesc(String receiverId);

    List<FoodRequest> findAllByOrderByCreatedAtDesc();

    void deleteByDonorId(String donorId);

    void deleteByReceiverId(String receiverId);

    void deleteByFoodId(String foodId);

    long countByFoodIdAndStatus(String foodId, String status);
}
