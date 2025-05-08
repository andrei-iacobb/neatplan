import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class HouseKeeper {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ length: 100 })
  name: string

  @Column({ default: false })
  isActive: boolean
}
