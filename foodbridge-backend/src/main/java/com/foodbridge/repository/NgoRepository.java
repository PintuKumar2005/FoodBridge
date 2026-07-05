package com.foodbridge.repository;

import com.foodbridge.entity.Ngo;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface NgoRepository extends MongoRepository<Ngo, String> {

    Optional<Ngo> findByUserId(String userId);
}
