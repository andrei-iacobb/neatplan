"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Colors } from "../constants/Colors"
import { getTasks, updateTaskStatus } from "../api/tasks"
import { format } from "date-fns"

interface Task {
  id: number
  title: string
  location: string
  status: string
  assigned_to_name: string
  scheduled_for: string
}

export default function HomeScreen({ navigation }: any) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
  })

  useEffect(() => {
    fetchTasks()

    // Refresh tasks when the screen comes into focus
    const unsubscribe = navigation.addListener("focus", () => {
      fetchTasks()
    })

    return unsubscribe
  }, [navigation])

  const fetchTasks = async () => {
    setIsLoading(true)
    try {
      const data = await getTasks()
      setTasks(data)

      // Calculate stats
      const total = data.length
      const completed = data.filter((task) => task.status === "completed").length
      const pending = total - completed

      setStats({
        total,
        completed,
        pending,
      })
    } catch (error) {
      console.error("Error fetching tasks:", error)
      Alert.alert("Error", "Failed to load tasks. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateStatus = async (taskId: number, newStatus: string) => {
    try {
      await updateTaskStatus(taskId, newStatus)

      // Update local state
      setTasks((prevTasks) => prevTasks.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task)))

      // Update stats
      if (newStatus === "completed") {
        setStats((prev) => ({
          ...prev,
          completed: prev.completed + 1,
          pending: prev.pending - 1,
        }))
      } else if (newStatus === "pending" && tasks.find((t) => t.id === taskId)?.status === "completed") {
        setStats((prev) => ({
          ...prev,
          completed: prev.completed - 1,
          pending: prev.pending + 1,
        }))
      }

      Alert.alert("Success", "Task status updated successfully")
    } catch (error) {
      console.error("Error updating task status:", error)
      Alert.alert("Error", "Failed to update task status. Please try again.")
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "No date"
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a")
    } catch (error) {
      return "Invalid date"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#4CAF50"
      case "in-progress":
        return "#2196F3"
      case "pending":
        return "#FFC107"
      default:
        return "#9E9E9E"
    }
  }

  const renderTaskItem = ({ item }: { item: Task }) => (
    <TouchableOpacity
      style={styles.taskItem}
      onPress={() => {
        Alert.alert(
          "Update Task Status",
          `Do you want to mark "${item.title}" as ${item.status === "completed" ? "pending" : "completed"}?`,
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Yes",
              onPress: () => handleUpdateStatus(item.id, item.status === "completed" ? "pending" : "completed"),
            },
          ],
        )
      }}
    >
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle}>{item.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      <View style={styles.taskDetails}>
        <Text style={styles.taskLocation}>{item.location || "No location"}</Text>
        <Text style={styles.taskTime}>{formatDate(item.scheduled_for)}</Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome back!</Text>
        <Text style={styles.subtitle}>Here's your task overview</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Tasks</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      <View style={styles.tasksContainer}>
        <Text style={styles.sectionTitle}>Your Tasks</Text>
        {isLoading && tasks.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
            <Text style={styles.loadingText}>Loading tasks...</Text>
          </View>
        ) : (
          <FlatList
            data={tasks}
            renderItem={renderTaskItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.tasksList}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTasks} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-done-circle-outline" size={60} color={Colors.light.tabIconDefault} />
                <Text style={styles.emptyText}>No tasks assigned to you yet</Text>
              </View>
            }
          />
        )}
      </View>

      <TouchableOpacity style={styles.scanButton} onPress={() => navigation.navigate("ScanDocument")}>
        <Ionicons name="scan" size={24} color="#fff" />
        <Text style={styles.scanButtonText}>Scan Document</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    padding: 20,
    backgroundColor: Colors.light.tint,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    margin: 15,
    marginTop: -20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCard: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    marginTop: 5,
  },
  tasksContainer: {
    flex: 1,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: Colors.light.text,
  },
  tasksList: {
    paddingBottom: 80,
  },
  taskItem: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  taskDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  taskLocation: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
  },
  taskTime: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.tabIconDefault,
    marginTop: 10,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.light.tabIconDefault,
  },
  scanButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: Colors.light.tint,
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
})

