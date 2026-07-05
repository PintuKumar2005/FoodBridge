# FoodBridge Spring Boot Backend

Enterprise Spring Boot replacement for the existing Node.js FoodBridge API.

## Current Increment

This increment creates the backend foundation:

- Maven project targeting Java 21 and Spring Boot 3.x
- MongoDB configuration with auditing and automatic indexes
- Spring Security, CORS, BCrypt, Swagger/OpenAPI, Cloudinary, Java Mail dependencies
- Core package structure requested by the migration plan
- Document models for User, Donation, Request, NGO, Volunteer, Notification, and Feedback
- Shared DTOs, exception handling, repositories, utilities, and health endpoint

## Compatibility Notes

The existing React frontend currently calls:

- `POST /api/donors`
- `POST /api/receivers`
- `POST /api/auth/send-otp`
- `POST /api/auth/direct-login`
- `POST /api/auth/verify-otp`
- `POST /api/donations`
- `GET /api/donations`
- `DELETE /api/donations/{id}`
- `POST /api/food-requests`
- `GET /api/food-requests`
- `PATCH /api/food-requests/{id}`

Those response shapes will be preserved while adding JWT-based enterprise authentication.

## Run

```bash
mvn spring-boot:run
```

The API starts on `http://localhost:4000` by default.

Swagger UI:

```text
http://localhost:4000/swagger-ui.html
```

## Environment

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/foodbridge
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
JWT_SECRET=replace-with-a-strong-production-secret
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
MAIL_HOST=localhost
MAIL_PORT=1025
```

## Module Roadmap

1. Authentication: register, login, OTP compatibility, JWT access/refresh tokens, forgot/reset password, email verification.
2. Users: profile update, image upload, change password, role/status management.
3. Donations: create, edit, delete, search, filter, history, status transitions.
4. NGO: browse donations, request donations, accept/reject request flow, tracking.
5. Volunteer: assigned deliveries, accept delivery, status updates, delivery history.
6. Admin: dashboard statistics, user/NGO/volunteer/donation management, reports, analytics, block/unblock.
7. Notifications: email and in-app donation/request status updates.
