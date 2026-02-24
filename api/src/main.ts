import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import {
  HttpExceptionFilter,
  AllExceptionsFilter,
} from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // Increase JSON body limit for base64 face images (up to ~50 MB payload)
  const express = await import("express");
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Security headers
  app.use(helmet());

  // Cookie parser (needed for JWT cookie extraction)
  app.use(cookieParser());

  // CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) =>
    o.trim(),
  ) ?? ["http://localhost:3000"];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global interceptors
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Global filters (specific first, fallback last)
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  // Swagger at /api/docs
  const config = new DocumentBuilder()
    .setTitle("BFP Sorsogon Attendance API")
    .setDescription("REST API for BFP Sorsogon Attendance System")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = parseInt(process.env.PORT ?? "3001", 10);
  await app.listen(port);
  console.log(`Application running on port ${port}`);
}

bootstrap();
