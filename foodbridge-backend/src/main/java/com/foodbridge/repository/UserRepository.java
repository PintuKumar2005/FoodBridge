package com.foodbridge.repository;

import com.foodbridge.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByTypeAndPhone(String type, String phone);

    Optional<User> findByEmailIgnoreCase(String email);

    List<User> findByType(String type);

    boolean existsByTypeAndPhone(String type, String phone);

    long countByType(String type);
}
