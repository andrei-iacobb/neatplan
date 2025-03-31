import axios from "axios"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Base URL for API requests
const API_URL = "http://localhost:3000/api" // Change this to your server URL

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Add token to requests if available
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Authentication functions
export const login = async (username: string, password: string) => {
  try {
    // Use the token endpoint for mobile authentication
    const response = await api.post("/auth/token", { username, password })
    await AsyncStorage.setItem("token", response.data.access_token)
    await AsyncStorage.setItem("user", JSON.stringify(response.data.user))
    return response.data
  } catch (error) {
    throw error
  }
}

export const register = async (username: string, password: string) => {
  try {
    const response = await api.post("/auth/register", { username, password })
    return response.data
  } catch (error) {
    throw error
  }
}

export const logout = async () => {
  try {
    await AsyncStorage.removeItem("token")
    await AsyncStorage.removeItem("user")
  } catch (error) {
    throw error
  }
}

export const isAuthenticated = async () => {
  try {
    const token = await AsyncStorage.getItem("token")
    return !!token
  } catch (error) {
    return false
  }
}

export const getCurrentUser = async () => {
  try {
    const userString = await AsyncStorage.getItem("user")
    if (userString) {
      return JSON.parse(userString)
    }
    return null
  } catch (error) {
    return null
  }
}

export default api

