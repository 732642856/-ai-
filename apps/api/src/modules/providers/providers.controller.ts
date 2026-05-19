import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common"
import { IsEnum, IsOptional, IsString, IsUrl } from "class-validator"
import { ProvidersService } from "./providers.service"

class CreateProviderKeyDto {
  @IsString()
  name!: string

  @IsUrl({ require_tld: false })
  baseUrl!: string

  @IsString()
  apiKey!: string

  @IsOptional()
  @IsString()
  defaultModel?: string

  @IsOptional()
  @IsEnum(["PERSONAL", "ORGANIZATION"])
  scope?: "PERSONAL" | "ORGANIZATION"
}

class TestProviderKeyDto {
  @IsOptional()
  @IsString()
  credentialId?: string

  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string

  @IsOptional()
  @IsString()
  apiKey?: string
}

@Controller("providers")
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  listProviders() {
    return {
      data: this.providersService.listSupportedProviders(),
    }
  }

  @Get("keys")
  async listProviderKeys() {
    return {
      data: await this.providersService.listProviderKeys(),
    }
  }

  @Post("keys")
  async createProviderKey(@Body() body: CreateProviderKeyDto) {
    return {
      data: await this.providersService.createProviderKey(body),
    }
  }

  @Post("keys/test")
  async testProviderKey(@Body() body: TestProviderKeyDto) {
    return {
      data: await this.providersService.testProviderKey(body),
    }
  }

  @Delete("keys/:id")
  async deleteProviderKey(@Param("id") id: string) {
    return {
      data: await this.providersService.deleteProviderKey(id),
    }
  }
}
