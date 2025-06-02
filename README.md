# CleanTrack - Advanced Cleaning Management System

A modern, AI-powered cleaning management system built with Next.js, TypeScript, and Prisma. Features intelligent document processing, seamless account switching, and comprehensive task management.

## 🚀 Features

### **Multi-User System**
- **Administrator**: Full system access, room management, schedule creation
- **Manager**: Standard access for operations oversight  
- **Cleaner**: Task-focused interface for cleaning operations

### **Seamless Account Switching**
- Instant switching between user roles without login redirects
- Session persistence across browser restarts
- Visual session indicators and role-based access control

### **AI-Powered Schedule Management**
- Intelligent document processing for cleaning schedules
- Automatic frequency detection from uploaded documents
- Manual override capabilities for AI suggestions
- Smart schedule assignment with auto-frequency selection

### **Enhanced Room Management**
- 54+ pre-configured rooms (bedrooms, offices, meeting rooms)
- Floor-based organization (Ground Floor, Upstairs)
- Real-time schedule status tracking
- Bulk assignment capabilities

### **Advanced UI/UX**
- Modern dark theme with teal accents
- Responsive design for desktop and mobile
- Animated transitions and micro-interactions
- Intuitive navigation and filtering

## 🏗️ Architecture

### **Tech Stack**
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Prisma ORM
- **Database**: PostgreSQL (or SQLite for development)
- **Authentication**: NextAuth.js with JWT
- **AI**: Custom document processing and frequency detection

### **Key Components**
- **Multi-User Authentication**: Session-based switching between roles
- **Schedule Engine**: AI-powered frequency detection and assignment
- **Room Management**: Hierarchical organization and bulk operations
- **Task Interface**: Role-specific dashboards and workflows

## 🎯 Quick Start

### **Account Access**

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| **Administrator** | `admin@cleantrack.com` | `admin123` | Full system access |
| **Manager** | `user@cleantrack.com` | `user123` | Standard operations |
| **Cleaner** | `cleaner@cleantrack.com` | `cleaner123` | Task management |

### **Development Setup**

```bash
# Install dependencies
npm install

# Set up database
npx prisma db push
npx prisma db seed

# Start development server
npm run dev
```

Visit `http://localhost:3002` (or next available port)

## 💡 How to Use

### **1. Account Switching**
- Login with any account
- Hover over the sidebar to expand
- Click your account section to see the switcher
- Use "Quick Access" to instantly switch between roles

### **2. Room Management (Admin/Manager)**
- Navigate to "Rooms" in the sidebar
- Toggle between Bedrooms, Other Rooms, and Schedules
- Use Quick Assignment for bulk schedule application
- Manual Assignment for specific room configurations

### **3. Schedule Management**
- Upload documents for AI processing
- Review and edit AI-detected frequencies
- Assign schedules to rooms with automatic frequency selection
- Monitor completion status and overdue items

### **4. Cleaning Operations (Cleaner)**
- Access the dedicated cleaner interface at `/clean`
- View prioritized task lists (Overdue, Due Today, Upcoming)
- Filter by floor, room type, or search terms
- Complete tasks with progress tracking

## 🔧 Advanced Features

### **AI Document Processing**
- Automatic extraction of cleaning schedules from uploaded documents
- Frequency detection (Daily, Weekly, Monthly, Quarterly, Yearly)
- Task identification and categorization
- Manual override capabilities for AI suggestions

### **Session Management**
- JWT-based authentication with 30-day expiration
- Local storage of session tokens for quick switching
- Automatic session cleanup and validation
- Cross-browser session persistence

### **Smart Scheduling**
- Auto-frequency selection based on AI detection
- Bulk assignment to room types
- Schedule status tracking and notifications
- Customizable frequency overrides

## 🎨 Design System

### **Color Palette**
- **Primary**: Teal (`#14B8A6`) - Actions, links, active states
- **Background**: Dark gray (`#111827`) - Main background
- **Surface**: Medium gray (`#1F2937`) - Cards, modals
- **Text**: Light gray (`#F9FAFB`) - Primary text
- **Accent**: Blue (`#3B82F6`) - Session indicators, secondary actions

### **Typography**
- **Headings**: Font weights 600-700, responsive sizing
- **Body**: Font weight 400, optimized line heights
- **Labels**: Font weight 500, small sizing for metadata

### **Components**
- **Buttons**: Consistent hover states, loading indicators
- **Cards**: Subtle borders, hover animations
- **Modals**: Backdrop blur, smooth transitions
- **Forms**: Inline validation, clear error states

## 📊 System Architecture

### **Database Schema**
- **Users**: Multi-role authentication system
- **Rooms**: Hierarchical organization with metadata
- **Schedules**: AI-enhanced template system
- **RoomSchedules**: Assignment and tracking junction
- **Tasks**: Granular operation definitions

### **API Structure**
```
/api
├── auth/          # Authentication endpoints
├── rooms/         # Room management
├── schedules/     # Schedule operations
├── cleaner/       # Cleaner-specific endpoints
└── upload/        # Document processing
```

### **Frontend Architecture**
```
/src
├── app/           # Next.js app router
├── components/    # Reusable UI components
├── hooks/         # Custom React hooks
├── lib/           # Utility functions
└── types/         # TypeScript definitions
```

## 🚀 Production Deployment

The system is production-ready with:
- Environment-based configuration
- Secure session management
- Optimized database queries
- Responsive design
- Error boundary handling
- Performance monitoring

## 🔒 Security Features

- **JWT Authentication**: Secure token-based sessions
- **Role-Based Access**: Granular permission system
- **Session Validation**: Automatic token verification
- **CSRF Protection**: Built-in Next.js security
- **Data Sanitization**: Input validation and cleaning

---

**Built with ❤️ for efficient facility management**
