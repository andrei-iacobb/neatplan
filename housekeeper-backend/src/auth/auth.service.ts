import { Injectable, UnauthorizedException, Logger } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { User } from "src/entities/user.entity"
import * as bcrypt from "bcrypt"
import type { JwtService } from "@nestjs/jwt"

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private jwtService: JwtService,
    ) {}
  async register(username: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = this.userRepository.create({ username, password: hashedPassword })
    this.logger.log(`User registered: ${username}`, "AuthService")
    return this.userRepository.save(user)
  }
  async login(username: string, password: string): Promise<{ access_token: string }> {
    const user = await this.userRepository.findOne({ where: { username } })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      this.logger.warn(`Failed login attempt: ${username}`, "AuthService")
      throw new UnauthorizedException("Invalid Credentials!")
    }
    const payload = { username: user.username, sub: user.id }
    this.logger.log(`User logged in: ${username} `, "AuthService")
    return { access_token: this.jwtService.sign(payload) }
  }
}

