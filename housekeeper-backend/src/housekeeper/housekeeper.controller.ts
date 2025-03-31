import { Controller, Get, Post, Body } from "@nestjs/common"
import type { HousekeeperService } from "./housekeeper.service"

@Controller("housekeeper")
export class HousekeeperController {
  constructor(private readonly housekeeperService: HousekeeperService) {}

  @Get()
  async getAll() {
    return this.housekeeperService.findAll()
  }

  @Post()
    async create(@Body('name') name: string) { 
        return this.housekeeperService.create(name);
    }
}

