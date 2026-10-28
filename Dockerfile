# JODOK full-stack Spring Boot app for Render Free, with bundled demo assets.
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre-jammy
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends default-mysql-client \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /build/target/*.jar /app/app.jar
COPY seed/fashionweb.sql /app/seed/fashionweb.sql
COPY uploads/ /app/uploads/
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
ENV SPRING_PROFILES_ACTIVE=prod
# 512MB Render free. Override JAVA_TOOL_OPTIONS in Render if necessary.
ENV JAVA_TOOL_OPTIONS="-Xms64m -Xmx240m -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=24m -XX:MaxDirectMemorySize=24m -Xss512k -XX:+UseSerialGC -XX:ActiveProcessorCount=1"
EXPOSE 10000
ENTRYPOINT ["/bin/bash", "/app/docker-entrypoint.sh"]
