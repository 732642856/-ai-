import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common"
import { IsOptional, IsString } from "class-validator"
import { ProjectsService } from "./projects.service"

class CreateProjectDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  description?: string
}

class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string
}

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async listProjects() {
    return {
      data: await this.projectsService.listProjects(),
    }
  }

  @Post()
  async createProject(@Body() body: CreateProjectDto) {
    return {
      data: await this.projectsService.createProject(body),
    }
  }

  @Patch(":projectId")
  async updateProject(@Param("projectId") projectId: string, @Body() body: UpdateProjectDto) {
    return {
      data: await this.projectsService.updateProject(projectId, body),
    }
  }
}
