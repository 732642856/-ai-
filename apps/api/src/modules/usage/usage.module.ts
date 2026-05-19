import { Module } from "@nestjs/common"
import { ProjectsModule } from "../projects/projects.module"
import { UsageController } from "./usage.controller"
import { UsageService } from "./usage.service"

@Module({
  imports: [ProjectsModule],
  controllers: [UsageController],
  providers: [UsageService],
})
export class UsageModule {}
