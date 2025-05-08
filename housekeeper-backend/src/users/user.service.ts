import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { User } from "src/entities/user.entity"

@Injectable()
export class UserService {
  constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ){}

  async findAll(): Promise<User[]> {
    return this.userRepository.find()
  }
}
