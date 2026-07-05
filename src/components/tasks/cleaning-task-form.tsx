"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiRequest } from "@/lib/url-utils"

const taskSchema = z.object({
  taskDescription: z.string().min(1, "Task description is required"),
  frequency: z.string().min(1, "Frequency is required"),
  estimatedDuration: z.string().min(1, "Estimated duration is required"),
  roomId: z.string().optional(),
})

type TaskValues = z.infer<typeof taskSchema>

interface Room {
  id: string
  name: string
}

interface CleaningTaskFormProps {
  rooms: Room[]
  onCreated?: () => void
}

export function CleaningTaskForm({ rooms, onCreated }: CleaningTaskFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<TaskValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      taskDescription: "",
      frequency: "Weekly",
      estimatedDuration: "30 min",
      roomId: "",
    },
  })

  async function onSubmit(data: TaskValues) {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiRequest("/api/cleaning-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskDescription: data.taskDescription,
          frequency: data.frequency,
          estimatedDuration: data.estimatedDuration,
          roomId: data.roomId || undefined,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to create task")
      }

      form.reset()
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-4 p-4 rounded-lg bg-black/20 backdrop-blur-sm border border-white/5">
      <h2 className="text-lg font-medium text-gray-100">Create Cleaning Task</h2>
      {error && (
        <p className="text-sm text-red-300">{error}</p>
      )}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium text-gray-300">Task Description</label>
          <Input
            {...form.register("taskDescription")}
            placeholder="e.g., Deep clean carpets"
            disabled={isLoading}
            className="bg-gray-800/50 border-gray-700 text-gray-100"
          />
          {form.formState.errors.taskDescription && (
            <p className="text-sm text-red-400">
              {form.formState.errors.taskDescription.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium text-gray-300">Frequency</label>
            <Input
              {...form.register("frequency")}
              placeholder="e.g., Weekly"
              disabled={isLoading}
              className="bg-gray-800/50 border-gray-700 text-gray-100"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium text-gray-300">Duration</label>
            <Input
              {...form.register("estimatedDuration")}
              placeholder="e.g., 30 min"
              disabled={isLoading}
              className="bg-gray-800/50 border-gray-700 text-gray-100"
            />
          </div>
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium text-gray-300">Room (optional)</label>
          <select
            {...form.register("roomId")}
            className="w-full rounded-md border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-gray-100"
            disabled={isLoading}
          >
            <option value="">Unassigned</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Creating..." : "Create Task"}
        </Button>
      </form>
    </div>
  )
}
