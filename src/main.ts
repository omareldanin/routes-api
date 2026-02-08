import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // ✅ Enable CORS
  app.enableCors({
    origin: "*", // Your frontend origin (e.g. Vite dev server)
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown fields
      forbidNonWhitelisted: false,
      transform: true, // 👈 enables class-transformer
      transformOptions: {
        enableImplicitConversion: true, // 👈 auto convert string -> number/boolean
      },
    }),
  );

  app.set("query parser", "extended"); // <-- Add this line
  await app.listen(3200);

  process.on("SIGINT", async () => {
    await app.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await app.close();
    process.exit(0);
  });
}
bootstrap();
