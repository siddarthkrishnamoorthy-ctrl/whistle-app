import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );
  // Served outside the /api/v1 prefix (useStaticAssets bypasses
  // setGlobalPrefix) so uploaded image URLs stay simple: /uploads/<file>.
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads" });
  app.setGlobalPrefix("api/v1");
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
}

bootstrap();
