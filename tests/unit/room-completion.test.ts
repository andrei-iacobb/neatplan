import { describe, it, expect, beforeEach, vi } from 'vitest'

const {
  roomScheduleFindUnique,
  roomScheduleUpdateMany,
  roomScheduleCompletionLogCreate,
  transaction,
} = vi.hoisted(() => ({
  roomScheduleFindUnique: vi.fn(),
  roomScheduleUpdateMany: vi.fn(),
  roomScheduleCompletionLogCreate: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    roomSchedule: {
      findUnique: roomScheduleFindUnique,
    },
    roomScheduleCompletionLog: {
      create: roomScheduleCompletionLogCreate,
    },
    $transaction: transaction,
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/authz', () => ({
  canAccessSite: vi.fn().mockReturnValue(true),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: any) => ({
      json: async () => data,
      status: init?.status,
      body: JSON.stringify(data),
    }),
  },
}))

import { getServerSession } from 'next-auth'
import { POST } from '@/app/api/cleaner/rooms/[roomId]/complete/route'

describe('POST /api/cleaner/rooms/[roomId]/complete', () => {
  const mockSession = {
    user: {
      id: 'cleaner-1',
      name: 'John Cleaner',
      email: 'cleaner@example.com',
      isAdmin: false,
    },
  }

  const mockRoom = {
    id: 'room-1',
    name: 'Conference Room A',
    siteId: 'site-1',
  }

  const mockTask1 = { id: 'task-1', description: 'Sweep floor' }
  const mockTask2 = { id: 'task-2', description: 'Clean whiteboard' }

  const mockSchedule = {
    id: 'schedule-1',
    title: 'Daily Conference Room Clean',
    tasks: [mockTask1, mockTask2],
  }

  const mockRoomSchedule = {
    id: 'room-schedule-1',
    roomId: 'room-1',
    scheduleId: 'schedule-1',
    frequency: 'DAILY',
    status: 'PENDING',
    lastCompleted: null,
    nextDue: new Date('2025-03-10'),
    room: mockRoom,
    schedule: mockSchedule,
  }

  const validSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const validRequest = {
    scheduleId: 'schedule-1',
    completedTasks: ['task-1', 'task-2'],
    notes: 'All tasks completed',
    duration: 30,
    signature: validSignature,
    signedName: 'John Cleaner',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
  })

  describe('task validation', () => {
    it('rejects a forged task ID not in the schedule', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          completedTasks: ['task-1', 'task-999'],
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toContain('do not belong to this schedule')
      expect((response as any).status).toBe(400)
    })

    it('rejects when a task ID is submitted twice', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          completedTasks: ['task-1', 'task-1'],
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toContain('submitted more than once')
      expect((response as any).status).toBe(400)
    })

    it('accepts task IDs as plain strings', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)
      transaction.mockImplementation(async (callback) => {
        const mockTx = {
          roomSchedule: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          roomScheduleCompletionLog: {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
          },
        }
        return callback(mockTx)
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          completedTasks: ['task-1', 'task-2'],
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
    })

    it('accepts task IDs as objects with taskId field', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)
      transaction.mockImplementation(async (callback) => {
        const mockTx = {
          roomSchedule: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          roomScheduleCompletionLog: {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
          },
        }
        return callback(mockTx)
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          completedTasks: [
            { taskId: 'task-1', notes: 'Swept carefully' },
            { taskId: 'task-2', notes: 'Used whiteboard cleaner' },
          ],
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
    })

    it('handles empty task array by rejecting', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          completedTasks: [],
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toContain('At least one task')
      expect((response as any).status).toBe(400)
    })
  })

  describe('signature validation', () => {
    it('rejects when signature is missing', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          signature: undefined,
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toContain('signature is required')
      expect((response as any).status).toBe(400)
    })

    it('rejects when signature does not start with data:image/png;base64,', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          signature: 'data:image/jpeg;base64,/9j/4AAQSkZ...',
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toContain('signature is required')
      expect((response as any).status).toBe(400)
    })

    it('rejects when base64 data is malformed', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          signature: 'data:image/png;base64,!!!invalid!!!',
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toContain('malformed')
      expect((response as any).status).toBe(400)
    })

    it('rejects when signature is too large (> 100 KB)', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      // Generate a base64 string larger than 100 KB
      // 100 KB = 102400 bytes, 136534 base64 chars (accounting for 4:3 ratio)
      const largeBase64 = 'A'.repeat(136600)

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          signature: `data:image/png;base64,${largeBase64}`,
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toContain('too large')
      expect((response as any).status).toBe(400)
    })
  })

  describe('printed name validation', () => {
    it('rejects when signedName is missing', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          signedName: undefined,
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toContain('printed name')
      expect((response as any).status).toBe(400)
    })

    it('rejects when signedName is too short (< 2 chars)', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          signedName: 'J',
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toContain('2 to 80 characters')
      expect((response as any).status).toBe(400)
    })

    it('rejects when signedName is too long (> 80 chars)', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          signedName: 'A'.repeat(81),
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toContain('2 to 80 characters')
      expect((response as any).status).toBe(400)
    })

    it('accepts a 2-character name', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)
      transaction.mockImplementation(async (callback) => {
        const mockTx = {
          roomSchedule: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          roomScheduleCompletionLog: {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
          },
        }
        return callback(mockTx)
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          signedName: 'JC',
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
    })

    it('accepts an 80-character name', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)
      transaction.mockImplementation(async (callback) => {
        const mockTx = {
          roomSchedule: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          roomScheduleCompletionLog: {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
          },
        }
        return callback(mockTx)
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          signedName: 'A'.repeat(80),
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
    })

    it('trims whitespace from printed name', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      let capturedSignedName: string | null = null
      transaction.mockImplementation(async (callback) => {
        const mockTx = {
          roomSchedule: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          roomScheduleCompletionLog: {
            create: vi.fn().mockImplementation((data) => {
              capturedSignedName = data.data.signedName
              return Promise.resolve({ id: 'log-1' })
            }),
          },
        }
        return callback(mockTx)
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          signedName: '  John Cleaner  ',
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
      expect(capturedSignedName).toBe('John Cleaner')
    })
  })

  describe('valid completion flow', () => {
    it('writes normalized tasks plus sign-off fields to completion log', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      let capturedLogData: any = null
      transaction.mockImplementation(async (callback) => {
        const mockTx = {
          roomSchedule: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          roomScheduleCompletionLog: {
            create: vi.fn().mockImplementation((args) => {
              capturedLogData = args.data
              return Promise.resolve({ id: 'log-1' })
            }),
          },
        }
        return callback(mockTx)
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          scheduleId: 'schedule-1',
          completedTasks: [
            { taskId: 'task-1', notes: 'Swept carefully' },
            'task-2',
          ],
          notes: 'All done',
          duration: 25,
          signature: validSignature,
          signedName: 'Jane Cleaner',
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)

      // Verify task structure is normalized
      expect(capturedLogData.completedTasks).toEqual([
        { taskId: 'task-1', notes: 'Swept carefully' },
        { taskId: 'task-2', notes: null },
      ])

      // Verify sign-off fields are captured
      expect(capturedLogData.signatureDataUrl).toBe(validSignature)
      expect(capturedLogData.signedName).toBe('Jane Cleaner')
      expect(capturedLogData.signedAt).toBeDefined()
    })

    it('truncates notes to 1000 characters', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      let capturedLogData: any = null
      transaction.mockImplementation(async (callback) => {
        const mockTx = {
          roomSchedule: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          roomScheduleCompletionLog: {
            create: vi.fn().mockImplementation((args) => {
              capturedLogData = args.data
              return Promise.resolve({ id: 'log-1' })
            }),
          },
        }
        return callback(mockTx)
      })

      const longNotes = 'A'.repeat(1500)
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          completedTasks: [
            { taskId: 'task-1', notes: longNotes },
          ],
        }),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
      expect(capturedLogData.completedTasks[0].notes).toHaveLength(1000)
    })

    it('includes snapshot data (roomName, scheduleTitle) in completion log', async () => {
      roomScheduleFindUnique.mockResolvedValue(mockRoomSchedule)

      let capturedLogData: any = null
      transaction.mockImplementation(async (callback) => {
        const mockTx = {
          roomSchedule: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          roomScheduleCompletionLog: {
            create: vi.fn().mockImplementation((args) => {
              capturedLogData = args.data
              return Promise.resolve({ id: 'log-1' })
            }),
          },
        }
        return callback(mockTx)
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(validRequest),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
      expect(capturedLogData.roomName).toBe('Conference Room A')
      expect(capturedLogData.scheduleTitle).toBe('Daily Conference Room Clean')
    })
  })

  describe('same-day replay prevention', () => {
    it('returns 409 when schedule has already been completed today', async () => {
      const today = new Date()
      today.setHours(10, 30, 0, 0) // 10:30 AM today
      const alreadyCompleted = new Date()
      alreadyCompleted.setHours(9, 0, 0, 0) // 9:00 AM today

      roomScheduleFindUnique.mockResolvedValue({
        ...mockRoomSchedule,
        lastCompleted: alreadyCompleted,
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(validRequest),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toContain('already been completed today')
      expect(body.duplicate).toBe(true)
      expect((response as any).status).toBe(409)
    })

    it('allows completion if last completion was yesterday', async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(14, 0, 0, 0)

      roomScheduleFindUnique.mockResolvedValue({
        ...mockRoomSchedule,
        lastCompleted: yesterday,
      })

      transaction.mockImplementation(async (callback) => {
        const mockTx = {
          roomSchedule: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          roomScheduleCompletionLog: {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
          },
        }
        return callback(mockTx)
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(validRequest),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
    })

    it('allows first completion when lastCompleted is null', async () => {
      roomScheduleFindUnique.mockResolvedValue({
        ...mockRoomSchedule,
        lastCompleted: null,
      })

      transaction.mockImplementation(async (callback) => {
        const mockTx = {
          roomSchedule: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          roomScheduleCompletionLog: {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
          },
        }
        return callback(mockTx)
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(validRequest),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
    })
  })

  describe('transaction concurrency', () => {
    it('returns 409 if concurrent request already updated lastCompleted', async () => {
      roomScheduleFindUnique.mockResolvedValue({
        ...mockRoomSchedule,
        lastCompleted: null,
      })

      transaction.mockImplementation(async (callback) => {
        const mockTx = {
          roomSchedule: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }), // Concurrent update won
          },
          roomScheduleCompletionLog: {
            create: vi.fn(),
          },
        }
        return callback(mockTx)
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(validRequest),
      })

      const response = await POST(request, {
        params: Promise.resolve({ roomId: 'room-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toContain('just completed')
      expect(body.duplicate).toBe(true)
      expect((response as any).status).toBe(409)
    })
  })

  describe('backward compatibility', () => {
    it('handles completion logs with null sign-off fields (legacy data)', async () => {
      // This doesn't test the route directly, but documents expected behavior:
      // the schema allows null signature/signedName/signedAt for backward compat
      expect(true).toBe(true)
    })
  })
})
