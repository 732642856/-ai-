import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { PrismaClient } from "@prisma/client"

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private isConnected = false

  async onModuleInit() {
    try {
      await this.$connect()
      this.isConnected = true
    } catch (error) {
      this.isConnected = false
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[Prisma] Database unavailable in local development: ${message}`)
      console.warn("[Prisma] API health checks can still respond, but data-backed endpoints require PostgreSQL.")
    }
  }

  get connected() {
    return this.isConnected
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
