export enum RoomType {
  OFFICE = 'OFFICE',
  MEETING_ROOM = 'MEETING_ROOM',
  BATHROOM = 'BATHROOM',
  KITCHEN = 'KITCHEN',
  LOBBY = 'LOBBY',
  STORAGE = 'STORAGE',
  BEDROOM = 'BEDROOM',
  LOUNGE = 'LOUNGE',
  OTHER = 'OTHER'
}

export interface Room {
  id: string
  name: string
  description?: string | null
  floor?: string | null
  type: RoomType
  createdAt: Date
  updatedAt: Date
} 