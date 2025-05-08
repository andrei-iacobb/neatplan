import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { HouseKeeper } from "src/entities/housekeeper.entity"

@Injectable()
export class HousekeeperService {
  constructor(
        @InjectRepository(HouseKeeper)
        private housekeeperRepo: Repository<HouseKeeper>,
    ) {}

  //get all house keepers
  async findAll(): Promise<HouseKeeper[]> {
    return this.housekeeperRepo.find()
  }

  //create a new one
  async create(name: string): Promise<HouseKeeper> {
    const housekeeper = this.housekeeperRepo.create({ name })
    return this.housekeeperRepo.save(housekeeper)
  }
}
