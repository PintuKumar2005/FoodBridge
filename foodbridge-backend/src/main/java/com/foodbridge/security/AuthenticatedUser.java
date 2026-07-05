package com.foodbridge.security;

import com.foodbridge.entity.UserRole;
import java.util.Set;

public record AuthenticatedUser(
    String id,
    String type,
    Set<UserRole> roles
) {
}
