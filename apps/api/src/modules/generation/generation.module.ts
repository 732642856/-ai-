import { Module } from "@nestjs/common"
import { ProjectsModule } from "../projects/projects.module"
import { GenerationController } from "./generation.controller"
import { GenerationService } from "./generation.service"

@Module({
  imports: [ProjectsModule],
  controllers: [GenerationController],
  providers: [GenerationService],
})
export class GenerationModule {}
