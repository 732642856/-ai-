import { Module } from "@nestjs/common"
import { ProjectsModule } from "../projects/projects.module"
import { CanvasController } from "./canvas.controller"
import { CanvasService } from "./canvas.service"

@Module({
  imports: [ProjectsModule],
  controllers: [CanvasController],
  providers: [CanvasService],
})
export class CanvasModule {}
