import { Injectable } from "@nestjs/common"
import { BillingMode } from "@prisma/client"
import { PrismaService } from "../../prisma/prisma.service"
import { ProjectsService } from "../projects/projects.service"

@Injectable()
export class UsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async getCurrentMonthSummary() {
    const { user, organization } = await this.projectsService.ensureDevContext()
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const records = await this.prisma.usageRecord.findMany({
      where: {
        organizationId: organization.id,
        userId: user.id,
        createdAt: { gte: periodStart },
      },
      select: {
        billingMode: true,
        creditsUsed: true,
        inputTokens: true,
        outputTokens: true,
        estimatedCostCny: true,
      },
    })

    return records.reduce(
      (summary, record) => {
        summary.creditsUsed += record.creditsUsed
        summary.inputTokens += record.inputTokens
        summary.outputTokens += record.outputTokens
        summary.estimatedCostCny += record.estimatedCostCny ? Number(record.estimatedCostCny) : 0

        if (record.billingMode === BillingMode.PLATFORM_CREDITS) {
          summary.platformRequests += 1
        } else {
          summary.byokRequests += 1
        }

        return summary
      },
      {
        organizationId: organization.id,
        period: "current_month",
        creditsUsed: 0,
        byokRequests: 0,
        platformRequests: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostCny: 0,
      },
    )
  }
}
