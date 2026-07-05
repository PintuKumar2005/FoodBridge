package com.foodbridge.repository;

import com.foodbridge.entity.Donation;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface DonationRepository extends MongoRepository<Donation, String> {

    List<Donation> findByDonorIdOrderByCreatedAtDesc(String donorId);

    void deleteByDonorId(String donorId);

    List<Donation> findByStatusInOrderByCreatedAtDesc(List<String> statuses);

    List<Donation> findAllByOrderByCreatedAtDesc();
}
