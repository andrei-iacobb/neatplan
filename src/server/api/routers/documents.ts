import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"
import { TRPCError } from "@trpc/server"
import { v4 as uuidv4 } from "uuid"
import { writeFile } from "fs/promises"
import path from "path"

// Mock AI processing function
async function processDocumentWithAI(filePath: string) {
  // In a real implementation, this would call an AI service
  // For demo purposes, we'll return mock data

  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000))

  return {
    building: "Main Building",
    rooms: [
      {
        number: "101",
        tasks: [
          { name: "Make Bed", priority: 3, description: "Change sheets and make bed" },
          { name: "Clean Bathroom", priority: 2, description: "Clean sink, toilet, and shower" },
          { name: "Vacuum Floor", priority: 1, description: "Vacuum entire room" },
        ],
      },
      {
        number: "102",
        tasks: [
          { name: "Make Bed", priority: 3, description: "Change sheets and make bed" },
          { name: "Clean Bathroom", priority: 2, description: "Clean sink, toilet, and shower" },
          { name: "Dust Surfaces", priority: 1, description: "Dust all surfaces" },
        ],
      },
      {
        number: "201",
        tasks: [
          { name: "Make Bed", priority: 3, description: "Change sheets and make bed" },
          { name: "Clean Bathroom", priority: 2, description: "Clean sink, toilet, and shower" },
          { name: "Empty Trash", priority: 1, description: "Empty all trash bins" },
        ],
      },
    ],
  }
}

export const documentsRouter = createTRPCRouter({
  processDocument: protectedProcedure.input(z.object({ formData: z.any() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    try {
      // Extract file from formData
      const formData = input.formData as FormData
      const file = formData.get("file") as File

      if (!file) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No file uploaded",
        })
      }

      // Check file type
      if (!file.type.includes("image/") && !file.type.includes("application/pdf")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid file type. Please upload an image or PDF.",
        })
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), "uploads")
      try {
        await writeFile(path.join(uploadsDir, ".gitkeep"), "")
      } catch (error) {
        // Directory already exists or cannot be created
      }

      // Generate unique filename
      const uniqueFilename = `${uuidv4()}${path.extname(file.name)}`
      const filePath = path.join(uploadsDir, uniqueFilename)

      // Save file to disk
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filePath, buffer)

      // Save document record to database
      const document = await ctx.prisma.document.create({
        data: {
          filename: file.name,
          filePath: uniqueFilename,
          uploadedById: userId,
          status: "processing",
        },
      })

      // Process document with AI
      const extractedData = await processDocumentWithAI(filePath)

      // Process each room and its tasks
      let tasksCreated = 0
      let roomsProcessed = 0

      for (const roomData of extractedData.rooms) {
        roomsProcessed++

        // Check if room exists
        let room = await ctx.prisma.room.findFirst({
          where: {
            number: roomData.number,
            building: extractedData.building,
          },
        })

        // Create room if it doesn't exist
        if (!room) {
          room = await ctx.prisma.room.create({
            data: {
              number: roomData.number,
              building: extractedData.building,
              status: "dirty",
              floor: roomData.number.charAt(0),
              type: "standard",
              qrCode: uuidv4(),
            },
          })
        } else {
          // Update room status to dirty
          await ctx.prisma.room.update({
            where: { id: room.id },
            data: { status: "dirty" },
          })
        }

        // Create tasks for this room
        for (const taskData of roomData.tasks) {
          // Set due date for tomorrow
          const dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + 1)

          // Create task
          await ctx.prisma.task.create({
            data: {
              name: taskData.name,
              description: taskData.description || taskData.name,
              priority: taskData.priority,
              status: "pending",
              dueDate,
              roomId: room.id,
              documentId: document.id,
            },
          })

          tasksCreated++
        }
      }

      // Update document status
      await ctx.prisma.document.update({
        where: { id: document.id },
        data: {
          status: "processed",
          processedAt: new Date(),
        },
      })

      return {
        success: true,
        documentId: document.id,
        tasksCreated,
        roomsProcessed,
      }
    } catch (error) {
      console.error("Document processing error:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to process document",
      })
    }
  }),
})
