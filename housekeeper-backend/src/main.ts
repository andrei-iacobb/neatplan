import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { ConfigService } from "@nestjs/config"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Get the port from .env
  const configService = app.get(ConfigService)
  const port = configService.get<number>("PORT") || 3002

  await app.listen(port)
  console.log(`🚀 Server running on http://localhost:${port}`)
  console.log("this is going crazy")
}
bootstrap()

