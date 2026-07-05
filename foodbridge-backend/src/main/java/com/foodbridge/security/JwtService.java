package com.foodbridge.security;

import com.foodbridge.entity.User;
import com.foodbridge.entity.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final JwtProperties properties;
    private final SecretKey signingKey;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
        this.signingKey = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
    }

    public String createAccessToken(User user) {
        return createToken(user, properties.accessTokenExpirationMs(), "access");
    }

    public String createRefreshToken(User user) {
        return createToken(user, properties.refreshTokenExpirationMs(), "refresh");
    }

    public AuthenticatedUser parseAccessToken(String token) {
        Claims claims = Jwts.parser()
            .verifyWith(signingKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();

        if (!"access".equals(claims.get("tokenType", String.class))) {
            throw new IllegalArgumentException("Unsupported token type");
        }

        @SuppressWarnings("unchecked")
        List<String> roleNames = claims.get("roles", List.class);
        Set<UserRole> roles = roleNames == null ? Set.of() : roleNames.stream()
            .map(String::valueOf)
            .map(UserRole::valueOf)
            .collect(Collectors.toUnmodifiableSet());

        return new AuthenticatedUser(claims.getSubject(), claims.get("type", String.class), roles);
    }

    private String createToken(User user, long ttlMillis, String tokenType) {
        Instant now = Instant.now();
        return Jwts.builder()
            .id(UUID.randomUUID().toString())
            .subject(user.getId())
            .claim("type", user.getType())
            .claim("roles", user.getRoles().stream().map(Enum::name).toList())
            .claim("tokenType", tokenType)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusMillis(ttlMillis)))
            .signWith(signingKey)
            .compact();
    }
}
