import api from "./auth"

// Get tasks for the current user
export const getTasks = async (status?: string) => {
  try {
    const url = status ? `/tasks?status=${status}` : "/tasks"
    const response = await api.get(url)
    return response.data
  } catch (error) {
    throw error
  }
}

// Update task status
export const updateTaskStatus = async (taskId: number, status: string) => {
  try {
    const response = await api.put("/tasks", { taskId, status })
    return response.data
  } catch (error) {
    throw error
  }
}

// Upload document for processing
export const uploadDocument = async (file: FormData) => {
  try {
    const response = await api.post("/documents", file, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

