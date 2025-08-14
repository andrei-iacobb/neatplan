'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit, Trash2, UserPlus, Shield, User as UserIcon, X, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { apiRequest } from '@/lib/url-utils'

const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  isAdmin: z.boolean(),
})

type UserFormData = z.infer<typeof userSchema>

interface User {
  id: string
  name: string
  email: string
  isAdmin: boolean
  isBlocked?: boolean
  forcePasswordChange?: boolean
  temporaryUnblockUntil?: string | null
}

function UserFormModal({ user, onClose, onSave }: { user: Partial<User> | null, onClose: () => void, onSave: (data: any) => void }) {
  const { toast } = useToast()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      password: '',
      isAdmin: user?.isAdmin || false,
    },
  })

  const onSubmit = async (data: UserFormData) => {
    try {
      await onSave(data)
      onClose()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save user.',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl w-full max-w-md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-100">{user?.id ? 'Edit User' : 'Add New User'}</h2>
            <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-200"><X /></button>
          </div>
          <div className="space-y-4">
            <input {...register('name')} placeholder="Name" className="w-full p-2 bg-gray-700 rounded" />
            {errors.name && <p className="text-red-400 text-sm">{errors.name.message}</p>}
            
            <input {...register('email')} placeholder="Email" className="w-full p-2 bg-gray-700 rounded" />
            {errors.email && <p className="text-red-400 text-sm">{errors.email.message}</p>}
            
            <input type="password" {...register('password')} placeholder={user?.id ? 'New Password (optional)' : 'Password'} className="w-full p-2 bg-gray-700 rounded" />
            {errors.password && <p className="text-red-400 text-sm">{errors.password.message}</p>}

            <div className="flex items-center gap-2">
              <input type="checkbox" {...register('isAdmin')} id="isAdmin" className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-teal-500 focus:ring-teal-500" />
              <label htmlFor="isAdmin" className="text-gray-300">Administrator</label>
            </div>
          </div>
          <div className="flex justify-end gap-4 mt-8">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-300">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function DeleteConfirmationModal({ user, onClose, onConfirm }: { user: User, onClose: () => void, onConfirm: () => Promise<void> }) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    await onConfirm()
    setIsDeleting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 border border-red-500/30 rounded-xl shadow-xl w-full max-w-md p-6"
      >
        <div className="flex items-start gap-4">
          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-900/50 sm:mx-0">
            <AlertTriangle className="h-6 w-6 text-red-400" aria-hidden="true" />
          </div>
          <div className="mt-0 text-left">
            <h3 className="text-lg leading-6 font-medium text-gray-100" id="modal-title">
              Delete User
            </h3>
            <div className="mt-2">
              <p className="text-sm text-gray-400">
                Are you sure you want to delete <span className="font-bold text-gray-200">{user.name}</span>? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
          <button
            type="button"
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:w-auto sm:text-sm disabled:opacity-50"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            type="button"
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-600 shadow-sm px-4 py-2 bg-gray-700 text-base font-medium text-gray-200 hover:bg-gray-600 sm:mt-0 sm:w-auto sm:text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const res = await apiRequest('/api/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      if (!session?.user?.isAdmin) {
        router.replace('/clean')
      } else {
        fetchUsers()
      }
    }
  }, [status, session, router])

  const handleSaveUser = async (data: UserFormData) => {
    const isEditing = !!editingUser?.id
    const url = isEditing ? `/api/users/${editingUser.id}` : '/api/users'
    const method = isEditing ? 'PUT' : 'POST'
    
    // Don't send empty password field on edit unless it's being changed
    const payload = { ...data };
    if (isEditing && !payload.password) {
      delete payload.password;
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errorData = await res.json()
      throw new Error(errorData.error || 'Failed to save user')
    }

    toast({
      title: 'Success',
      description: `User ${isEditing ? 'updated' : 'created'} successfully.`,
    })
    
    setIsModalOpen(false)
    setEditingUser(null)
    fetchUsers()
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    
    try {
      const res = await apiRequest(`/api/users/${deletingUser.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to delete user.')
      }
      toast({ title: 'Success', description: 'User deleted successfully.' })
      setDeletingUser(null)
      fetchUsers()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  if (isLoading) return <p className="text-center p-8">Loading users...</p>
  if (error) return <p className="text-center p-8 text-red-400">Error: {error}</p>

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-100">User Management</h1>
              <p className="text-gray-400 mt-2">Add, edit, or remove users.</p>
            </div>
            <button 
              onClick={() => { setEditingUser({}); setIsModalOpen(true); }}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Add User
            </button>
          </div>
          
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-100">{user.name}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-400">{user.email}</div>
                        {user.isBlocked && (!user.temporaryUnblockUntil || new Date(user.temporaryUnblockUntil) < new Date()) && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-900 text-red-200">Blocked</span>
                        )}
                        {user.forcePasswordChange && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-yellow-900 text-yellow-200">Pwd change req</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isAdmin ? 'bg-teal-900 text-teal-200' : 'bg-gray-600 text-gray-200'}`}>
                        {user.isAdmin ? 'Admin' : 'Cleaner'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button onClick={() => { setEditingUser(user); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-teal-400 rounded-full hover:bg-gray-700 transition-colors"><Edit className="w-4 h-4" /></button>
                      {user.isBlocked ? (
                        <button
                          onClick={async () => {
                            try {
                              const res = await apiRequest(`/api/users/${user.id}/unblock`, { method: 'POST' })
                              if (!res.ok) throw new Error('Failed to unblock user')
                              toast({ description: 'User unblocked for 10 minutes. Must change password on next login.' })
                              fetchUsers()
                            } catch (e: any) {
                              toast({ description: e.message, variant: 'destructive' })
                            }
                          }}
                          className="p-2 text-red-300 hover:text-red-100 rounded-full hover:bg-red-900/50 transition-colors"
                        >
                          Unblock
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              const res = await apiRequest(`/api/users/${user.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ isBlocked: true })
                              })
                              if (!res.ok) throw new Error('Failed to block user')
                              toast({ description: 'User blocked' })
                              fetchUsers()
                            } catch (e: any) {
                              toast({ description: e.message, variant: 'destructive' })
                            }
                          }}
                          className="p-2 text-red-300 hover:text-red-100 rounded-full hover:bg-red-900/50 transition-colors"
                        >
                          Block
                        </button>
                      )}
                      <button onClick={() => setDeletingUser(user)} className="p-2 text-gray-400 hover:text-red-400 rounded-full hover:bg-gray-700 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isModalOpen && <UserFormModal user={editingUser} onClose={() => setIsModalOpen(false)} onSave={handleSaveUser} />}
        {deletingUser && <DeleteConfirmationModal user={deletingUser} onClose={() => setDeletingUser(null)} onConfirm={handleDeleteUser} />}
      </AnimatePresence>
    </>
  )
} 