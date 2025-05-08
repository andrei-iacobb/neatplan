"use client"

import { useState } from "react"
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Colors } from "../constants/Colors"

export default function TasksScreen() {
  const [activeTab, setActiveTab] = useState("all")

  const tasks = [
    { id: 1, title: "Room 203 Cleaning", status: "completed", assignedTo: "Maria Johnson", time: "10:30 AM" },
    { id: 2, title: "Lobby Maintenance", status: "in-progress", assignedTo: "John Smith", time: "11:45 AM" },
    { id: 3, title: "Room 105 Deep Clean", status: "completed", assignedTo: "Sarah Williams", time: "9:15 AM" },
    { id: 4, title: "Room 301 Cleaning", status: "scheduled", assignedTo: "Maria Johnson", time: "Tomorrow, 9:00 AM" },
    {
      id: 5,
      title: "Conference Room Setup",
      status: "scheduled",
      assignedTo: "John Smith",
      time: "Tomorrow, 10:30 AM",
    },
    { id: 6, title: "Room 402 Plumbing Issue", status: "issue", assignedTo: "Maintenance", time: "Today, 8:15 AM" },
    { id: 7, title: "Hallway Carpet Stain", status: "issue", assignedTo: "Cleaning Staff", time: "Yesterday, 4:30 PM" },
  ]

  const filteredTasks = activeTab === "all" ? tasks : tasks.filter((task) => task.status === activeTab)

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "#4CAF50"
      case "in-progress":
        return "#2196F3"
      case "scheduled":
        return "#FFC107"
      case "issue":
        return "#F44336"
      default:
        return "#9E9E9E"
    }
  }

  const renderTaskItem = ({ item }) => (
    <TouchableOpacity style={styles.taskItem}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle}>{item.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status === "in-progress"
              ? "In Progress"
              : item.status === "issue"
                ? "Issue"
                : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      <View style={styles.taskDetails}>
        <Text style={styles.taskAssignee}>Assigned to: {item.assignedTo}</Text>
        <Text style={styles.taskTime}>{item.time}</Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "all" && styles.activeTab]}
          onPress={() => setActiveTab("all")}
        >
          <Text style={[styles.tabText, activeTab === "all" && styles.activeTabText]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "scheduled" && styles.activeTab]}
          onPress={() => setActiveTab("scheduled")}
        >
          <Text style={[styles.tabText, activeTab === "scheduled" && styles.activeTabText]}>Scheduled</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "in-progress" && styles.activeTab]}
          onPress={() => setActiveTab("in-progress")}
        >
          <Text style={[styles.tabText, activeTab === "in-progress" && styles.activeTabText]}>In Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "completed" && styles.activeTab]}
          onPress={() => setActiveTab("completed")}
        >
          <Text style={[styles.tabText, activeTab === "completed" && styles.activeTabText]}>Completed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "issue" && styles.activeTab]}
          onPress={() => setActiveTab("issue")}
        >
          <Text style={[styles.tabText, activeTab === "issue" && styles.activeTabText]}>Issues</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredTasks}
        renderItem={renderTaskItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.tasksList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks in this category</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.addButton}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    flexWrap: "wrap",
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: Colors.light.tint,
  },
  tabText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  activeTabText: {
    color: "#fff",
    fontWeight: "500",
  },
  tasksList: {
    padding: 15,
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
  taskAssignee: {
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
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.tabIconDefault,
  },
  addButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: Colors.light.tint,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
})
