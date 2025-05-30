# 🎯 Task-Centric Cleaning Management System

## Overview
The system has been redesigned to be **task-centric** rather than schedule-centric, allowing multiple cleaning schedule types per room.

## 🔄 How It Works Now

### **Room Display Logic:**
- **Room appears if**: It has ANY pending tasks from ANY schedule type
- **Room card shows**: Summary of ALL pending tasks across all schedule types
- **When clicked**: Shows all individual pending tasks to complete

### **Schedule Types Supported:**
- **Daily Clean** - Regular daily maintenance
- **Deep Clean** - Weekly/monthly thorough cleaning  
- **Maintenance** - Repairs, equipment checks
- **Inspection** - Safety checks, assessments
- **Weekly Clean** - Standard weekly cleaning
- **Monthly Clean** - Monthly deep maintenance
- **Quarterly Clean** - Seasonal maintenance

## 📊 New Data Structure

### **Room Object:**
```typescript
interface Room {
  id: string
  name: string
  type: string
  floor: string
  priority: 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING'
  nextDue: string // Earliest due date across all schedules
  summary: {
    totalSchedules: number    // How many schedule types
    totalTasks: number       // Total tasks across all schedules
    estimatedDuration: string // Combined duration
    overdueCount: number     // How many schedules are overdue
    pendingCount: number     // How many schedules are pending
  }
  schedules: Schedule[]      // All active schedules for this room
}
```

## 🎮 User Experience

### **Dashboard View:**
- **Priority View**: Groups by Overdue → Due Today → Upcoming
- **Organized View**: Groups by Floor or Room Type
- **Room Cards**: Show summary of all pending tasks

### **Example Scenarios:**

#### **Scenario 1: Multiple Tasks Due**
```
Room 15 - Bedroom
├── Daily Clean (5 tasks) - Due Today
├── Deep Clean (12 tasks) - Overdue  
└── Maintenance (3 tasks) - Due Today

Summary: 3 schedule types, 20 tasks, Est. 1h 40min
Status: OVERDUE (because deep clean is overdue)
```

#### **Scenario 2: Single Task Type**
```
Room 8 - Bathroom  
└── Daily Clean (8 tasks) - Due Today

Summary: 1 schedule type, 8 tasks, Est. 40min
Status: DUE_TODAY
```

#### **Scenario 3: No Pending Tasks**
```
Room 22 - Office
├── Daily Clean - Completed (next due tomorrow)
└── Deep Clean - Completed (next due next week)

Status: Room hidden from dashboard
```

## 🆕 Adding New Schedule Types

### **1. Create Schedule in Admin:**
```sql
-- Example: Weekly Deep Clean
INSERT INTO schedules (title, tasks) VALUES 
('Weekly Deep Clean', [...tasks...]);
```

### **2. Assign to Rooms:**
```sql  
-- Assign with frequency
INSERT INTO room_schedules (roomId, scheduleId, frequency) VALUES
(1, 'deep-clean-schedule-id', 'WEEKLY');
```

### **3. System Auto-Detection:**
The system automatically detects schedule types based on title keywords:
- "deep clean" → Deep Clean
- "maintenance" → Maintenance  
- "inspection" → Inspection
- "daily" → Daily Clean
- etc.

## 🔧 Benefits

✅ **Multiple Schedule Types**: Rooms can have daily + weekly + monthly tasks  
✅ **Smart Prioritization**: Room priority based on most urgent task  
✅ **Task Aggregation**: See all pending work for a room at once  
✅ **Flexible Scheduling**: Different frequencies for different task types  
✅ **Clean UI**: One card per room regardless of task complexity  
✅ **Realistic Workflow**: Matches how cleaning actually works  

## 🚀 Next Steps

1. **Test the system** with current data
2. **Add more schedule types** as needed
3. **Room completion** will handle all pending schedules at once
4. **Automatic scheduling** continues to work for all schedule types

The system is now ready for complex cleaning operations with multiple overlapping schedules per room! 🎉 