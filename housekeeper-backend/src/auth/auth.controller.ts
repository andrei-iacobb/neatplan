import { Controller, Post, Body } from "@nestjs/common"
import type { AuthService } from "./auth.service"

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(@Body('username') username: string, @Body('password') password: string) {
    return this.authService.register(username, password)
  }
  @Post("login")
  async login(@Body('username') username: string, @Body('password') password: string) {
    return this.authService.login(username, password)
  }
}
