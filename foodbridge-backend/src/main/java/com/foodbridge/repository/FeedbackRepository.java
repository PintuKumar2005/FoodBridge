package com.foodbridge.repository;

import com.foodbridge.entity.Feedback;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface FeedbackRepository extends MongoRepository<Feedback, String> {

    List<Feedback> findByDonationId(String donationId);
}
