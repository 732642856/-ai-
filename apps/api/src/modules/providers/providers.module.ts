import { Module } from "@nestjs/common"
import { ProjectsModule } from "../projects/projects.module"
import { ProvidersController } from "./providers.controller"
import { ProvidersService } from "./providers.service"

@Module({
  imports: [ProjectsModule],
  controllers: [ProvidersController],
  providers: [ProvidersService],
})
export class ProvidersModule {}
