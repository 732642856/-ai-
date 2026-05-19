import { ValidationPipe } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { NestExpressApplication } from "@nestjs/platform-express"
import { json, urlencoded } from "express"
import { join } from "path"
import { AppModule } from "./app.module"

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const config = app.get(ConfigService)
  const corsOrigin = config.get<string>("CORS_ORIGIN") ?? "http://localhost:3000"

  app.enableCors({ origin: corsOrigin, credentials: true })
  app.use(json({ limit: "25mb" }))
  app.use(urlencoded({ extended: true, limit: "25mb" }))
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads/" })
  app.setGlobalPrefix("api/v1")
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  const port = Number(config.get<string>("API_PORT") ?? 4000)
  const host = config.get<string>("API_HOST") ?? "0.0.0.0"
  await app.listen(port, host)
}

void bootstrap()
