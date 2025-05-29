import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user.isAdmin) {
    redirect('/clean')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Rooms</h2>
          <p className="text-gray-600 mb-4">Manage rooms and their cleaning schedules</p>
          <a href="/rooms" className="text-blue-600 hover:text-blue-800">View Rooms →</a>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Schedules</h2>
          <p className="text-gray-600 mb-4">Create and manage cleaning schedules</p>
          <a href="/schedule" className="text-blue-600 hover:text-blue-800">View Schedules →</a>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Settings</h2>
          <p className="text-gray-600 mb-4">Configure system settings and preferences</p>
          <a href="/settings" className="text-blue-600 hover:text-blue-800">View Settings →</a>
        </div>
      </div>
    </div>
  )
} 