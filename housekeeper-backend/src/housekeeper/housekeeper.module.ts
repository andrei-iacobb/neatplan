import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { HouseKeeper } from "../entities/housekeeper.entity"
import { HousekeeperService } from "./housekeeper.service"
import { HousekeeperController } from "./housekeeper.controller"

@Module({
  imports: [TypeOrmModule.forFeature([HouseKeeper])],
  controllers: [HousekeeperController],
  providers: [HousekeeperService],
})
export class HousekeeperModule {}

