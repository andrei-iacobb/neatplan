# 🧹 CleanTrack

<div align="center">

![CleanTrack Logo](https://via.placeholder.com/200x100/4F46E5/FFFFFF?text=CleanTrack)

**A comprehensive cleaning management system with real-time tracking and mobile support**

[![Next.js](https://img.shields.io/badge/Next.js-15.3.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.8.2-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

[🚀 Live Demo](#) • [📖 Documentation](#documentation) • [🐛 Report Bug](../../issues) • [✨ Request Feature](../../issues)

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🎯 Demo](#-demo)
- [🚀 Quick Start](#-quick-start)
- [🔧 Installation](#-installation)
- [📱 Usage](#-usage)
- [🌐 Deployment](#-deployment)
- [🛠️ Tech Stack](#️-tech-stack)
- [📊 Database Schema](#-database-schema)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

### 🎛️ **Admin Dashboard**
- 📊 Real-time statistics and analytics
- 🏢 Room and equipment management
- 📅 Schedule assignment and monitoring
- 👥 User session tracking
- 📈 Live activity monitoring with 30-second updates
- 🔄 Equipment maintenance scheduling

### 🧹 **Cleaner Interface**
- 📱 Mobile-responsive personal dashboard
- 📋 Assigned room and equipment schedules
- ✅ Task completion tracking
- 🎯 Priority-based task organization
- 📍 Location-based room filtering

### 🔄 **Real-Time Features**
- 🟢 Live session tracking and monitoring
- 📡 Activity updates every 30 seconds
- 👁️ User presence indicators
- 🚪 Automatic logout detection
- 📊 Real-time dashboard statistics

### 🛡️ **Security & Authentication**
- 🔐 NextAuth.js integration
- 👤 Role-based access control (Admin/Cleaner)
- 🔑 Secure session management
- 🛡️ CSRF protection
- 🔒 Environment-based configuration

### 📱 **Mobile Support**
- 📲 Fully responsive design
- 👆 Touch-friendly interface
- 📱 Mobile-optimized navigation
- 🔄 Offline-capable PWA features

---

## 🎯 Demo

<div align="center">

### Admin Dashboard
![Admin Dashboard](https://via.placeholder.com/800x400/1F2937/FFFFFF?text=Admin+Dashboard+Screenshot)

### Cleaner Interface
![Cleaner Interface](https://via.placeholder.com/800x400/059669/FFFFFF?text=Cleaner+Interface+Screenshot)

### Mobile View
![Mobile View](https://via.placeholder.com/400x600/7C3AED/FFFFFF?text=Mobile+View+Screenshot)

</div>

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0 or higher
- **PostgreSQL** 15.0 or higher
- **npm** or **yarn**

### 1-Minute Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/cleantrack.git
cd cleantrack

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Setup database
npx prisma generate
npx prisma db push
npx prisma db seed

# Start development server
npm run dev
```

🎉 **That's it!** Open [http://localhost:3000](http://localhost:3000) and start cleaning!

---

## 🔧 Installation

<details>
<summary><b>📦 Detailed Installation Guide</b></summary>

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/cleantrack.git
cd cleantrack
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Database Setup
```bash
# Create PostgreSQL database
createdb cleantrack

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Seed with sample data
npx prisma db seed
```

### 4. Environment Configuration
```bash
# Copy environment template
cp .env.example .env
```

Edit `.env` file:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/cleantrack"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
```

### 5. Build & Start
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

</details>

---

## 📱 Usage

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@cleantrack.com` | `admin123` |
| **Cleaner** | `cleaner@cleantrack.com` | `cleaner123` |
| **User** | `user@cleantrack.com` | `user123` |

### Admin Workflow

1. **Dashboard Overview** - View real-time statistics
2. **Manage Rooms** - Add, edit, and organize cleaning spaces
3. **Equipment Management** - Track maintenance schedules
4. **Schedule Assignment** - Assign cleaning tasks to rooms/equipment
5. **Monitor Activity** - Track user sessions and task completion

### Cleaner Workflow

1. **Personal Dashboard** - View assigned tasks
2. **Task Management** - Complete room and equipment schedules
3. **Progress Tracking** - Monitor completion status
4. **Mobile Access** - Use on any device

---

## 🌐 Deployment

### 🪟 Windows Self-Hosting

Perfect for small to medium businesses:

```bash
# Use provided Windows scripts
scripts\windows\install.bat
scripts\windows\start.bat
```

📖 **Full Windows Guide**: [README-Windows.md](README-Windows.md)

### ☁️ Cloud Deployment

<details>
<summary><b>Deploy to Vercel</b></summary>

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyourusername%2Fcleantrack)

1. Connect your PostgreSQL database
2. Set environment variables
3. Deploy!

</details>

<details>
<summary><b>Deploy to Railway</b></summary>

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/cleantrack)

1. One-click deployment
2. Automatic PostgreSQL provisioning
3. Environment setup included

</details>

<details>
<summary><b>Deploy with Docker</b></summary>

```bash
# Build image
docker build -t cleantrack .

# Run container
docker run -p 3000:3000 --env-file .env cleantrack
```

</details>

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15.3.2
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: Radix UI
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js
- **Framework**: Next.js API Routes
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: NextAuth.js
- **Session Management**: Custom implementation

### Development
- **Package Manager**: npm
- **Linting**: ESLint
- **Formatting**: Prettier
- **Type Checking**: TypeScript
- **Database Management**: Prisma Studio

---

## 📊 Database Schema

<details>
<summary><b>📋 View Database Structure</b></summary>

```mermaid
erDiagram
    User ||--o{ UserSession : has
    User ||--o{ Task : creates
    Room ||--o{ RoomSchedule : has
    Equipment ||--o{ EquipmentSchedule : has
    Schedule ||--o{ RoomSchedule : assigned_to
    Schedule ||--o{ EquipmentSchedule : assigned_to
    Schedule ||--o{ ScheduleTask : contains
    RoomSchedule ||--o{ RoomScheduleCompletionLog : completed
    EquipmentSchedule ||--o{ EquipmentScheduleCompletionLog : completed

    User {
        string id PK
        string email UK
        string name
        boolean isAdmin
        enum role
        datetime createdAt
        datetime updatedAt
    }

    Room {
        string id PK
        string name UK
        string description
        string floor
        enum type
        datetime createdAt
        datetime updatedAt
    }

    Equipment {
        string id PK
        string name UK
        string description
        string type
        datetime createdAt
        datetime updatedAt
    }
```

</details>

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### 🐛 Bug Reports
- Use the [issue tracker](../../issues)
- Include steps to reproduce
- Provide system information

### ✨ Feature Requests
- Check [existing issues](../../issues) first
- Describe the feature and use case
- Consider implementation approach

### 🔧 Pull Requests
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests if applicable
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### 📋 Development Setup
```bash
# Clone your fork
git clone https://github.com/yourusername/cleantrack.git

# Install dependencies
npm install

# Setup development database
npm run db:setup

# Start development server
npm run dev

# Run tests
npm test
```

---

## 📈 Roadmap

- [ ] 📧 Email notifications for overdue tasks
- [ ] 📊 Advanced analytics and reporting
- [ ] 🔔 Push notifications
- [ ] 📱 Native mobile app
- [ ] 🌍 Multi-language support
- [ ] 🔗 API for third-party integrations
- [ ] 📦 Inventory management
- [ ] 🎨 Custom themes and branding

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React framework for production
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [NextAuth.js](https://next-auth.js.org/) - Authentication for Next.js
- [Framer Motion](https://www.framer.com/motion/) - Animation library

---

<div align="center">

**Made with ❤️ for cleaning professionals**

[⭐ Star this repo](../../stargazers) • [🐛 Report issues](../../issues) • [💬 Discussions](../../discussions)

</div>
