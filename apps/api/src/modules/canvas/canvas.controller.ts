import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common"
import { IsArray, IsObject, IsOptional, IsString } from "class-validator"
import { CanvasService } from "./canvas.service"

class SaveCanvasDto {
  @IsArray()
  nodes!: unknown[]

  @IsArray()
  edges!: unknown[]

  @IsObject()
  viewport!: Record<string, unknown>
}

class CreateCanvasVersionDto extends SaveCanvasDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  reason?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}

@Controller("projects/:projectId/canvas")
export class CanvasController {
  constructor(private readonly canvasService: CanvasService) {}

  @Get()
  async getCanvas(@Param("projectId") projectId: string) {
    return {
      data: await this.canvasService.getCanvas(projectId),
    }
  }

  @Put()
  async saveCanvas(@Param("projectId") projectId: string, @Body() body: SaveCanvasDto) {
    return {
      data: await this.canvasService.saveCanvas(projectId, body),
    }
  }

  @Get("versions")
  async listCanvasVersions(@Param("projectId") projectId: string) {
    return {
      data: await this.canvasService.listCanvasVersions(projectId),
    }
  }

  @Post("versions")
  async createCanvasVersion(@Param("projectId") projectId: string, @Body() body: CreateCanvasVersionDto) {
    return {
      data: await this.canvasService.createCanvasVersion(projectId, body),
    }
  }

  @Get("versions/:versionId")
  async getCanvasVersion(@Param("projectId") projectId: string, @Param("versionId") versionId: string) {
    return {
      data: await this.canvasService.getCanvasVersion(projectId, versionId),
    }
  }

  @Post("versions/:versionId/restore")
  async restoreCanvasVersion(@Param("projectId") projectId: string, @Param("versionId") versionId: string) {
    return {
      data: await this.canvasService.restoreCanvasVersion(projectId, versionId),
    }
  }
}
