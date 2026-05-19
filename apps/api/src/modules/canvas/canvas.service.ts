import { Injectable, NotFoundException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { PrismaService } from "../../prisma/prisma.service"
import { ProjectsService } from "../projects/projects.service"

@Injectable()
export class CanvasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async getCanvas(projectId: string) {
    await this.projectsService.ensureDevContext()

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { canvases: { orderBy: { updatedAt: "desc" }, take: 1 } },
    })

    if (!project) {
      throw new NotFoundException("Project not found")
    }

    const canvas = project.canvases[0]
    if (canvas) {
      return canvas
    }

    return this.prisma.canvasDocument.create({
      data: {
        projectId,
        name: "默认画布",
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    })
  }

  async saveCanvas(
    projectId: string,
    input: { nodes: unknown[]; edges: unknown[]; viewport: Record<string, unknown> },
  ) {
    const canvas = await this.getCanvas(projectId)

    return this.prisma.canvasDocument.update({
      where: { id: canvas.id },
      data: {
        nodes: input.nodes as Prisma.InputJsonValue,
        edges: input.edges as Prisma.InputJsonValue,
        viewport: input.viewport as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    })
  }

  async listCanvasVersions(projectId: string) {
    const canvas = await this.getCanvas(projectId)

    return this.prisma.canvasVersion.findMany({
      where: { canvasId: canvas.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        canvasId: true,
        version: true,
        title: true,
        reason: true,
        metadata: true,
        createdAt: true,
      },
    })
  }

  async createCanvasVersion(
    projectId: string,
    input: {
      nodes: unknown[]
      edges: unknown[]
      viewport: Record<string, unknown>
      title?: string
      reason?: string
      metadata?: Record<string, unknown>
    },
  ) {
    const canvas = await this.getCanvas(projectId)
    const nextVersion = canvas.version + 1

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.canvasVersion.create({
        data: {
          canvasId: canvas.id,
          version: nextVersion,
          title: input.title,
          reason: input.reason,
          nodes: input.nodes as Prisma.InputJsonValue,
          edges: input.edges as Prisma.InputJsonValue,
          viewport: input.viewport as Prisma.InputJsonValue,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      })

      await tx.canvasDocument.update({
        where: { id: canvas.id },
        data: { version: nextVersion },
      })

      return version
    })
  }

  async getCanvasVersion(projectId: string, versionId: string) {
    const canvas = await this.getCanvas(projectId)
    const version = await this.prisma.canvasVersion.findFirst({
      where: {
        id: versionId,
        canvasId: canvas.id,
      },
    })

    if (!version) {
      throw new NotFoundException("Canvas version not found")
    }

    return version
  }

  async restoreCanvasVersion(projectId: string, versionId: string) {
    const canvas = await this.getCanvas(projectId)
    const version = await this.getCanvasVersion(projectId, versionId)

    return this.prisma.canvasDocument.update({
      where: { id: canvas.id },
      data: {
        nodes: version.nodes as Prisma.InputJsonValue,
        edges: version.edges as Prisma.InputJsonValue,
        viewport: version.viewport as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    })
  }
}
