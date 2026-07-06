<<<<<<< HEAD
# Build stage
=======
>>>>>>> 16544b9 (Configure MongoDB Atlas connection)
FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

<<<<<<< HEAD
# Runtime stage
=======
>>>>>>> 16544b9 (Configure MongoDB Atlas connection)
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

<<<<<<< HEAD
ENTRYPOINT ["java", "-jar", "app.jar"]
=======
ENTRYPOINT ["java", "-jar", "app.jar"]
>>>>>>> 16544b9 (Configure MongoDB Atlas connection)
