import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { HouseKeeper } from "./entities/housekeeper.entity"
import { HousekeeperService } from "./housekeeper/housekeeper.service"
import { HousekeeperController } from "./housekeeper/housekeeper.controller"
import { HousekeeperModule } from "./housekeeper/housekeeper.module"
import { AuthModule } from "./auth/auth.module"
import { AppLogger } from "./logger/logger.service"
import { UserController } from "./users/user.controller"
import { UsersModule } from "./users/users.module"

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get<string>("DB_HOST"),
        port: configService.get<number>("DB_PORT"),
        username: configService.get<string>("DB_USER"),
        password: configService.get<string>("DB_PASSWORD"),
        database: configService.get<string>("DB_NAME"),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([HouseKeeper]),
    HousekeeperModule,
    AuthModule,
    UsersModule,
  ],
  providers: [HousekeeperService, AppLogger],
  controllers: [HousekeeperController, UserController],
  exports: [AppLogger],
})
export class AppModule {}
