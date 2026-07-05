package com.foodbridge.repository;

import com.foodbridge.entity.Volunteer;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface VolunteerRepository extends MongoRepository<Volunteer, String> {

    Optional<Volunteer> findByUserId(String userId);
}
