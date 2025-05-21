"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const taskSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  floor: z.string().min(1, "Floor is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: z.string().min(1, "Due date is required"),
})

type TaskValues = z.infer<typeof taskSchema>

export function CleaningTaskForm() {
  const [isLoading, setIsLoading] = useState(false)
  
  const form = useForm<TaskValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      roomNumber: "",
      floor: "",
      description: "",
      priority: "medium",
      dueDate: new Date().toISOString().split("T")[0],
    },
  })

  async function onSubmit(data: TaskValues) {
    setIsLoading(true)
    // TODO: Implement task creation logic
    console.log(data)
    setIsLoading(false)
  }

  return (
    <div className="grid gap-6 p-6 bg-white rounded-lg shadow-sm">
      <h2 className="text-2xl font-semibold tracking-tight">Create Cleaning Task</h2>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Room Number</label>
          <Input
            {...form.register("roomNumber")}
            placeholder="e.g., 101"
            disabled={isLoading}
          />
          {form.formState.errors.roomNumber && (
            <p className="text-sm text-red-500">
              {form.formState.errors.roomNumber.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Floor</label>
          <Input
            {...form.register("floor")}
            placeholder="e.g., 1st Floor"
            disabled={isLoading}
          />
          {form.formState.errors.floor && (
            <p className="text-sm text-red-500">
              {form.formState.errors.floor.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Description (Optional)</label>
          <textarea
            {...form.register("description")}
            className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            placeholder="Add any special instructions or notes..."
            disabled={isLoading}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Priority</label>
          <select
            {...form.register("priority")}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            disabled={isLoading}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Due Date</label>
          <Input
            {...form.register("dueDate")}
            type="date"
            disabled={isLoading}
          />
          {form.formState.errors.dueDate && (
            <p className="text-sm text-red-500">
              {form.formState.errors.dueDate.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && (
            <div className="mr-2 h-4 w-4 animate-spin" />
          )}
          Create Task
        </Button>
      </form>
    </div>
  )
} 