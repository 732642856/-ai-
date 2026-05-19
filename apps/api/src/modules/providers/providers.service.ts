import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { PrismaService } from "../../prisma/prisma.service"
import { ProjectsService } from "../projects/projects.service"

const PROVIDER_TYPE = "OPENAI_COMPATIBLE" as const
const DEFAULT_BASE_URL = "https://api.openai.com"
const DEFAULT_MODEL = "gpt-4o-mini"

interface CreateProviderKeyInput {
  name: string
  baseUrl: string
  apiKey: string
  defaultModel?: string
  scope?: "PERSONAL" | "ORGANIZATION"
}

interface TestProviderKeyInput {
  baseUrl?: string
  apiKey?: string
  credentialId?: string
}

@Injectable()
export class ProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly config: ConfigService,
  ) {}

  listSupportedProviders() {
    return [
      {
        id: "openai-compatible",
        type: PROVIDER_TYPE,
        name: "OpenAI Compatible",
        supportsByok: true,
        requiredFields: ["baseUrl", "apiKey", "defaultModel"],
      },
    ]
  }

  async listProviderKeys() {
    const { user, organization } = await this.projectsService.ensureDevContext()

    const keys = await this.prisma.providerCredential.findMany({
      where: {
        type: PROVIDER_TYPE,
        OR: [{ userId: user.id }, { organizationId: organization.id }],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        baseUrl: true,
        defaultModel: true,
        isEnabled: true,
        userId: true,
        organizationId: true,
        encryptedKey: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      type: key.type,
      scope: key.organizationId ? "ORGANIZATION" : "PERSONAL",
      baseUrl: key.baseUrl,
      defaultModel: key.defaultModel,
      isEnabled: key.isEnabled,
      maskedKey: this.maskKey(this.decrypt(key.encryptedKey)),
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }))
  }

  async createProviderKey(input: CreateProviderKeyInput) {
    const { user, organization } = await this.projectsService.ensureDevContext()
    const scope = input.scope ?? "PERSONAL"

    const key = await this.prisma.providerCredential.create({
      data: {
        type: PROVIDER_TYPE,
        name: input.name,
        baseUrl: this.normalizeBaseUrl(input.baseUrl),
        defaultModel: input.defaultModel ?? DEFAULT_MODEL,
        encryptedKey: this.encrypt(input.apiKey),
        userId: scope === "PERSONAL" ? user.id : undefined,
        organizationId: scope === "ORGANIZATION" ? organization.id : undefined,
      },
      select: {
        id: true,
        name: true,
        type: true,
        baseUrl: true,
        defaultModel: true,
        isEnabled: true,
        userId: true,
        organizationId: true,
        encryptedKey: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return {
      id: key.id,
      name: key.name,
      type: key.type,
      scope: key.organizationId ? "ORGANIZATION" : "PERSONAL",
      baseUrl: key.baseUrl,
      defaultModel: key.defaultModel,
      isEnabled: key.isEnabled,
      maskedKey: this.maskKey(input.apiKey),
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }
  }

  async deleteProviderKey(id: string) {
    const { user, organization } = await this.projectsService.ensureDevContext()

    const deleted = await this.prisma.providerCredential.deleteMany({
      where: {
        id,
        OR: [{ userId: user.id }, { organizationId: organization.id }],
      },
    })

    if (deleted.count === 0) {
      throw new NotFoundException("Provider key not found")
    }

    return { id, deleted: true }
  }

  async testProviderKey(input: TestProviderKeyInput) {
    const credential = input.credentialId ? await this.getAccessibleCredential(input.credentialId) : null
    const apiKey = input.apiKey ?? (credential ? this.decrypt(credential.encryptedKey) : undefined)
    const baseUrl = input.baseUrl ?? credential?.baseUrl ?? DEFAULT_BASE_URL

    if (!apiKey) {
      throw new BadRequestException("apiKey or credentialId is required")
    }

    const modelsUrl = `${this.normalizeBaseUrl(baseUrl)}/v1/models`

    try {
      const response = await fetch(modelsUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const text = await response.text()
        return {
          ok: false,
          message: `连接失败：${response.status} ${response.statusText}`,
          detail: text.slice(0, 500),
        }
      }

      const payload = (await response.json()) as { data?: Array<{ id?: string }> }
      const models = Array.isArray(payload.data)
        ? payload.data.map((model) => model.id).filter(Boolean).slice(0, 100)
        : []

      return {
        ok: true,
        message: "连接成功，已读取 /v1/models。",
        models,
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "连接失败：未知错误",
      }
    }
  }

  private async getAccessibleCredential(id: string) {
    const { user, organization } = await this.projectsService.ensureDevContext()
    const credential = await this.prisma.providerCredential.findFirst({
      where: {
        id,
        OR: [{ userId: user.id }, { organizationId: organization.id }],
      },
    })

    if (!credential) {
      throw new NotFoundException("Provider key not found")
    }

    return credential
  }

  private normalizeBaseUrl(baseUrl: string) {
    return baseUrl.replace(/\/v1\/?$/i, "").replace(/\/+$/, "")
  }

  private maskKey(apiKey: string) {
    if (apiKey.length <= 10) {
      return `${apiKey.slice(0, 2)}****${apiKey.slice(-2)}`
    }

    return `${apiKey.slice(0, 6)}****${apiKey.slice(-4)}`
  }

  private encrypt(value: string) {
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", this.getEncryptionKey(), iv)
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
    const authTag = cipher.getAuthTag()

    return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":")
  }

  private decrypt(payload: string) {
    const [ivText, authTagText, encryptedText] = payload.split(":")

    if (!ivText || !authTagText || !encryptedText) {
      return ""
    }

    const decipher = createDecipheriv("aes-256-gcm", this.getEncryptionKey(), Buffer.from(ivText, "base64"))
    decipher.setAuthTag(Buffer.from(authTagText, "base64"))

    return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64")), decipher.final()]).toString("utf8")
  }

  private getEncryptionKey() {
    const rawKey = this.config.get<string>("ENCRYPTION_KEY") ?? "creative-canvas-local-dev-key"
    return createHash("sha256").update(rawKey).digest()
  }
}
