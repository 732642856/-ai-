import { Body, Controller, Post } from "@nestjs/common"
import { IsEmail, IsString, MinLength } from "class-validator"

class LoginDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(6)
  password!: string
}

@Controller("auth")
export class AuthController {
  @Post("login")
  login(@Body() body: LoginDto) {
    return {
      data: {
        accessToken: "dev-placeholder-token",
        user: {
          id: "dev-user",
          email: body.email,
          name: "Dev User",
        },
      },
    }
  }
}
