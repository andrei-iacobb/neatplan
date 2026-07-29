import { describe, it, expect, beforeEach, vi } from 'vitest'

const {
  scheduleFindUnique,
  scheduleUpdate,
  scheduleDelete,
  scheduleDeleteMany,
  scheduleTaskCreate,
  scheduleTaskFindUnique,
  scheduleTaskUpdate,
  scheduleTaskDelete,
} = vi.hoisted(() => ({
  scheduleFindUnique: vi.fn(),
  scheduleUpdate: vi.fn(),
  scheduleDelete: vi.fn(),
  scheduleDeleteMany: vi.fn(),
  scheduleTaskCreate: vi.fn(),
  scheduleTaskFindUnique: vi.fn(),
  scheduleTaskUpdate: vi.fn(),
  scheduleTaskDelete: vi.fn(),
}))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    schedule: {
      findUnique: scheduleFindUnique,
      update: scheduleUpdate,
      delete: scheduleDelete,
      deleteMany: scheduleDeleteMany,
    },
    scheduleTask: {
      create: scheduleTaskCreate,
      findUnique: scheduleTaskFindUnique,
      update: scheduleTaskUpdate,
      delete: scheduleTaskDelete,
    },
  },
}))

vi.mock('next-auth/next', () => ({
  getServerSession: mockGetServerSession,
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

import { PUT as putSchedule, DELETE as deleteSchedule } from '@/app/api/schedules/[id]/route'
import { POST as postTask } from '@/app/api/schedules/[id]/tasks/route'
import { PUT as putTask, DELETE as deleteTask } from '@/app/api/schedules/[id]/tasks/[taskId]/route'

describe('Schedule Authorization - Cross-site Mutation Prevention', () => {
  const managerSession = {
    user: {
      id: 'manager-1',
      name: 'John Manager',
      email: 'manager@example.com',
      isAdmin: true,
      role: 'MANAGER',
      siteId: 'site-a',
    },
  }

  const directorSession = {
    user: {
      id: 'director-1',
      name: 'Jane Director',
      email: 'director@example.com',
      isAdmin: true,
      role: 'DIRECTOR',
      siteId: null,
    },
  }

  const opSession = {
    user: {
      id: 'op-1',
      name: 'Admin Op',
      email: 'op@example.com',
      isAdmin: true,
      role: 'OP',
      siteId: null,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PUT /api/schedules/[id] - Update schedule', () => {
    it('allows manager to update schedule owned by their single site', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }],
      })
      scheduleUpdate.mockResolvedValue({
        id: 'schedule-1',
        title: 'Updated Clean',
        sites: [{ id: 'site-a', name: 'Site A' }],
        tasks: [],
      })

      const request = new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated Clean' }),
      })

      const response = await putSchedule(request, {
        params: Promise.resolve({ id: 'schedule-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.title).toBe('Updated Clean')
      expect(scheduleUpdate).toHaveBeenCalled()
    })

    it('denies manager from updating schedule shared with other site', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
      })

      const request = new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated Clean' }),
      })

      const response = await putSchedule(request, {
        params: Promise.resolve({ id: 'schedule-shared' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toBe('Schedule not found')
      expect((response as any).status).toBe(404)
      expect(scheduleUpdate).not.toHaveBeenCalled()
    })

    it('allows director to update schedule shared across sites', async () => {
      mockGetServerSession.mockResolvedValue(directorSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
      })
      scheduleUpdate.mockResolvedValue({
        id: 'schedule-shared',
        title: 'Updated Multi-Site',
        sites: [{ id: 'site-a', name: 'Site A' }, { id: 'site-b', name: 'Site B' }],
        tasks: [],
      })

      const request = new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated Multi-Site' }),
      })

      const response = await putSchedule(request, {
        params: Promise.resolve({ id: 'schedule-shared' }),
      } as any)

      const body = await (response as any).json()
      expect(body.title).toBe('Updated Multi-Site')
      expect(scheduleUpdate).toHaveBeenCalled()
    })

    it('allows OP to update schedule shared across sites', async () => {
      mockGetServerSession.mockResolvedValue(opSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
      })
      scheduleUpdate.mockResolvedValue({
        id: 'schedule-shared',
        title: 'Updated by OP',
        sites: [{ id: 'site-a', name: 'Site A' }, { id: 'site-b', name: 'Site B' }],
        tasks: [],
      })

      const request = new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated by OP' }),
      })

      const response = await putSchedule(request, {
        params: Promise.resolve({ id: 'schedule-shared' }),
      } as any)

      const body = await (response as any).json()
      expect(body.title).toBe('Updated by OP')
      expect(scheduleUpdate).toHaveBeenCalled()
    })

    it('denies manager from accessing schedule they cannot see', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-b' }],
      })

      const request = new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated' }),
      })

      const response = await putSchedule(request, {
        params: Promise.resolve({ id: 'schedule-other' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toBe('Schedule not found')
      expect((response as any).status).toBe(404)
      expect(scheduleUpdate).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/schedules/[id] - Delete schedule', () => {
    it('allows manager to delete schedule owned by their single site', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }],
      })
      scheduleDeleteMany.mockResolvedValue({ count: 1 })

      const request = new Request('http://localhost', {
        method: 'DELETE',
      })

      const response = await deleteSchedule(request, {
        params: Promise.resolve({ id: 'schedule-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
      // The delete must repeat the "linked to exactly my site" condition rather than
      // trusting the earlier read, so a concurrent relink cannot slip through.
      expect(scheduleDeleteMany).toHaveBeenCalledWith({
        where: {
          id: 'schedule-1',
          sites: { every: { id: 'site-a' }, some: { id: 'site-a' } },
        },
      })
    })

    it('returns 404 when the guarded delete matches nothing (concurrent relink)', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }],
      })
      // Between the authorization read and the delete, the schedule gained a second site.
      scheduleDeleteMany.mockResolvedValue({ count: 0 })

      const request = new Request('http://localhost', { method: 'DELETE' })

      const response = await deleteSchedule(request, {
        params: Promise.resolve({ id: 'schedule-1' }),
      } as any)

      const body = await (response as any).json()
      expect((response as any).status).toBe(404)
      expect(body.error).toBe('Schedule not found')
    })

    it('denies manager from deleting schedule shared with other site', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
      })

      const request = new Request('http://localhost', {
        method: 'DELETE',
      })

      const response = await deleteSchedule(request, {
        params: Promise.resolve({ id: 'schedule-shared' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toBe('Schedule not found')
      expect((response as any).status).toBe(404)
      expect(scheduleDeleteMany).not.toHaveBeenCalled()
    })

    it('allows director to delete schedule shared across sites', async () => {
      mockGetServerSession.mockResolvedValue(directorSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
      })
      scheduleDeleteMany.mockResolvedValue({ count: 1 })

      const request = new Request('http://localhost', {
        method: 'DELETE',
      })

      const response = await deleteSchedule(request, {
        params: Promise.resolve({ id: 'schedule-shared' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
      // A DIRECTOR spans every site, so the delete is not narrowed by site links.
      expect(scheduleDeleteMany).toHaveBeenCalledWith({ where: { id: 'schedule-shared' } })
    })
  })

  describe('POST /api/schedules/[id]/tasks - Create task', () => {
    it('allows manager to create task for schedule owned by their single site', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }],
      })
      scheduleTaskCreate.mockResolvedValue({
        id: 'task-1',
        description: 'Sweep floor',
        frequency: 'DAILY',
        scheduleId: 'schedule-1',
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ description: 'Sweep floor', frequency: 'DAILY' }),
      })

      const response = await postTask(request, {
        params: Promise.resolve({ id: 'schedule-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.description).toBe('Sweep floor')
      expect(scheduleTaskCreate).toHaveBeenCalled()
    })

    it('denies manager from creating task for schedule shared with other site', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ description: 'Sweep floor' }),
      })

      const response = await postTask(request, {
        params: Promise.resolve({ id: 'schedule-shared' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toBe('Schedule not found')
      expect((response as any).status).toBe(404)
      expect(scheduleTaskCreate).not.toHaveBeenCalled()
    })

    it('allows director to create task for schedule shared across sites', async () => {
      mockGetServerSession.mockResolvedValue(directorSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
      })
      scheduleTaskCreate.mockResolvedValue({
        id: 'task-1',
        description: 'Polish floors',
        frequency: 'WEEKLY',
        scheduleId: 'schedule-shared',
      })

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ description: 'Polish floors', frequency: 'WEEKLY' }),
      })

      const response = await postTask(request, {
        params: Promise.resolve({ id: 'schedule-shared' }),
      } as any)

      const body = await (response as any).json()
      expect(body.description).toBe('Polish floors')
      expect(scheduleTaskCreate).toHaveBeenCalled()
    })
  })

  describe('PUT /api/schedules/[id]/tasks/[taskId] - Update task', () => {
    it('allows manager to update task in schedule owned by their single site', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleTaskFindUnique.mockResolvedValue({
        id: 'task-1',
        scheduleId: 'schedule-1',
        schedule: {
          sites: [{ id: 'site-a' }],
        },
      })
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }],
      })
      scheduleTaskUpdate.mockResolvedValue({
        id: 'task-1',
        description: 'Updated sweep floor',
        frequency: 'DAILY',
        scheduleId: 'schedule-1',
      })

      const request = new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ description: 'Updated sweep floor', frequency: 'DAILY' }),
      })

      const response = await putTask(request, {
        params: Promise.resolve({ id: 'schedule-1', taskId: 'task-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.description).toBe('Updated sweep floor')
      expect(scheduleTaskUpdate).toHaveBeenCalled()
    })

    it('denies manager from updating task in schedule shared with other site', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleTaskFindUnique.mockResolvedValue({
        id: 'task-1',
        scheduleId: 'schedule-shared',
        schedule: {
          sites: [{ id: 'site-a' }, { id: 'site-b' }],
        },
      })
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
      })

      const request = new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ description: 'Updated', frequency: 'DAILY' }),
      })

      const response = await putTask(request, {
        params: Promise.resolve({ id: 'schedule-shared', taskId: 'task-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toBe('Task not found')
      expect((response as any).status).toBe(404)
      expect(scheduleTaskUpdate).not.toHaveBeenCalled()
    })

    it('allows director to update task in schedule shared across sites', async () => {
      mockGetServerSession.mockResolvedValue(directorSession as any)
      scheduleTaskFindUnique.mockResolvedValue({
        id: 'task-1',
        scheduleId: 'schedule-shared',
        schedule: {
          sites: [{ id: 'site-a' }, { id: 'site-b' }],
        },
      })
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
      })
      scheduleTaskUpdate.mockResolvedValue({
        id: 'task-1',
        description: 'Director updated',
        frequency: 'WEEKLY',
        scheduleId: 'schedule-shared',
      })

      const request = new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ description: 'Director updated', frequency: 'WEEKLY' }),
      })

      const response = await putTask(request, {
        params: Promise.resolve({ id: 'schedule-shared', taskId: 'task-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.description).toBe('Director updated')
      expect(scheduleTaskUpdate).toHaveBeenCalled()
    })
  })

  describe('DELETE /api/schedules/[id]/tasks/[taskId] - Delete task', () => {
    it('allows manager to delete task in schedule owned by their single site', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleTaskFindUnique.mockResolvedValue({
        id: 'task-1',
        scheduleId: 'schedule-1',
        schedule: {
          sites: [{ id: 'site-a' }],
        },
      })
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }],
      })
      scheduleTaskDelete.mockResolvedValue({ id: 'task-1' })

      const request = new Request('http://localhost', {
        method: 'DELETE',
      })

      const response = await deleteTask(request, {
        params: Promise.resolve({ id: 'schedule-1', taskId: 'task-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
      expect(scheduleTaskDelete).toHaveBeenCalled()
    })

    it('denies manager from deleting task in schedule shared with other site', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleTaskFindUnique.mockResolvedValue({
        id: 'task-1',
        scheduleId: 'schedule-shared',
        schedule: {
          sites: [{ id: 'site-a' }, { id: 'site-b' }],
        },
      })
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
      })

      const request = new Request('http://localhost', {
        method: 'DELETE',
      })

      const response = await deleteTask(request, {
        params: Promise.resolve({ id: 'schedule-shared', taskId: 'task-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.error).toBe('Task not found')
      expect((response as any).status).toBe(404)
      expect(scheduleTaskDelete).not.toHaveBeenCalled()
    })

    it('allows director to delete task in schedule shared across sites', async () => {
      mockGetServerSession.mockResolvedValue(directorSession as any)
      scheduleTaskFindUnique.mockResolvedValue({
        id: 'task-1',
        scheduleId: 'schedule-shared',
        schedule: {
          sites: [{ id: 'site-a' }, { id: 'site-b' }],
        },
      })
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
      })
      scheduleTaskDelete.mockResolvedValue({ id: 'task-1' })

      const request = new Request('http://localhost', {
        method: 'DELETE',
      })

      const response = await deleteTask(request, {
        params: Promise.resolve({ id: 'schedule-shared', taskId: 'task-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
      expect(scheduleTaskDelete).toHaveBeenCalled()
    })

    it('allows OP to delete task in schedule shared across sites', async () => {
      mockGetServerSession.mockResolvedValue(opSession as any)
      scheduleTaskFindUnique.mockResolvedValue({
        id: 'task-1',
        scheduleId: 'schedule-shared',
        schedule: {
          sites: [{ id: 'site-a' }, { id: 'site-b' }],
        },
      })
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
      })
      scheduleTaskDelete.mockResolvedValue({ id: 'task-1' })

      const request = new Request('http://localhost', {
        method: 'DELETE',
      })

      const response = await deleteTask(request, {
        params: Promise.resolve({ id: 'schedule-shared', taskId: 'task-1' }),
      } as any)

      const body = await (response as any).json()
      expect(body.success).toBe(true)
      expect(scheduleTaskDelete).toHaveBeenCalled()
    })
  })

  describe('404 instead of 403 - information leakage prevention', () => {
    it('returns 404 when manager denied due to multi-site schedule (not 403)', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
      })

      const request = new Request('http://localhost', {
        method: 'DELETE',
      })

      const response = await deleteSchedule(request, {
        params: Promise.resolve({ id: 'schedule-shared' }),
      } as any)

      expect((response as any).status).toBe(404)
    })

    it('returns 404 when manager denied due to inaccessible site (not 403)', async () => {
      mockGetServerSession.mockResolvedValue(managerSession as any)
      scheduleFindUnique.mockResolvedValue({
        sites: [{ id: 'site-b' }],
      })

      const request = new Request('http://localhost', {
        method: 'DELETE',
      })

      const response = await deleteSchedule(request, {
        params: Promise.resolve({ id: 'schedule-other' }),
      } as any)

      expect((response as any).status).toBe(404)
    })
  })
})
