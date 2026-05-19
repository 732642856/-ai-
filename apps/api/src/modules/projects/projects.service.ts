import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../../prisma/prisma.service"

const DEV_USER = {
  id: "dev-user",
  email: "dev@creative-canvas.local",
  name: "Dev User",
}

const DEV_ORG = {
  id: "dev-org",
  name: "个人工作区",
  slug: "personal-dev",
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDevContext() {
    const user = await this.prisma.user.upsert({
      where: { email: DEV_USER.email },
      update: { name: DEV_USER.name },
      create: DEV_USER,
    })

    const organization = await this.prisma.organization.upsert({
      where: { slug: DEV_ORG.slug },
      update: { name: DEV_ORG.name },
      create: DEV_ORG,
    })

    await this.prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
      update: { role: "OWNER" },
      create: {
        organizationId: organization.id,
        userId: user.id,
        role: "OWNER",
      },
    })

    return { user, organization }
  }

  async listProjects() {
    const { organization } = await this.ensureDevContext()

    return this.prisma.project.findMany({
      where: { organizationId: organization.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async createProject(input: { name: string; description?: string }) {
    const { user, organization } = await this.ensureDevContext()

    return this.prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        organizationId: organization.id,
        ownerId: user.id,
        canvases: {
          create: {
            name: "默认画布",
            nodes: [],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async updateProject(projectId: string, input: { name?: string; description?: string }) {
    const { organization } = await this.ensureDevContext()
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: organization.id,
      },
    })

    if (!project) {
      throw new NotFoundException("Project not found")
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: input.name?.trim() || project.name,
        description: input.description ?? project.description,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }
}
