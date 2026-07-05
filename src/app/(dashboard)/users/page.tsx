'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit, Trash2, UserPlus, Shield, User as UserIcon, X, AlertTriangle, Users, Sparkles } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { apiRequest } from '@/lib/url-utils'
import { useThemeColors } from '@/hooks/useThemeColors'

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

type ThemeColors = ReturnType<typeof useThemeColors>

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

function UserFormModal({ user, onClose, onSave, tc }: { user: Partial<User> | null, onClose: () => void, onSave: (data: any) => void, tc: ThemeColors }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: tc.modalOverlay }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="rounded-xl w-full max-w-md"
        style={{ background: tc.modalBg, border: '1px solid ' + tc.cardBorder }}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold" style={{ color: tc.textPrimary }}>{user?.id ? 'Edit User' : 'Add New User'}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 transition-colors"
              style={{ color: tc.textMuted }}
              onMouseEnter={(e) => e.currentTarget.style.color = tc.textPrimary}
              onMouseLeave={(e) => e.currentTarget.style.color = tc.textMuted}
            >
              <X />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <input
                {...register('name')}
                placeholder="Name"
                className="w-full p-2.5 rounded-lg text-[14px] outline-none transition-colors"
                style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
              />
              {errors.name && <p className="text-[12px] mt-1" style={{ color: tc.statusOverdue.text }}>{errors.name.message}</p>}
            </div>

            <div>
              <input
                {...register('email')}
                placeholder="Email"
                className="w-full p-2.5 rounded-lg text-[14px] outline-none transition-colors"
                style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
              />
              {errors.email && <p className="text-[12px] mt-1" style={{ color: tc.statusOverdue.text }}>{errors.email.message}</p>}
            </div>

            <div>
              <input
                type="password"
                {...register('password')}
                placeholder={user?.id ? 'New Password (optional)' : 'Password'}
                className="w-full p-2.5 rounded-lg text-[14px] outline-none transition-colors"
                style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
              />
              {errors.password && <p className="text-[12px] mt-1" style={{ color: tc.statusOverdue.text }}>{errors.password.message}</p>}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" {...register('isAdmin')} id="isAdmin" className="h-4 w-4 rounded accent-emerald-500" />
              <label htmlFor="isAdmin" className="text-[13px]" style={{ color: tc.textSecondary }}>Administrator</label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
              style={{ background: tc.btnSecondaryBg, color: tc.btnSecondaryText, border: '1px solid ' + tc.btnSecondaryBorder }}
              onMouseEnter={(e) => e.currentTarget.style.background = tc.btnSecondaryHoverBg}
              onMouseLeave={(e) => e.currentTarget.style.background = tc.btnSecondaryBg}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
              style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: '1px solid ' + tc.btnPrimaryBorder }}
              onMouseEnter={(e) => e.currentTarget.style.background = tc.btnPrimaryHoverBg}
              onMouseLeave={(e) => e.currentTarget.style.background = tc.btnPrimaryBg}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function DeleteConfirmationModal({ user, onClose, onConfirm, tc }: { user: User, onClose: () => void, onConfirm: () => Promise<void>, tc: ThemeColors }) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    await onConfirm()
    setIsDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: tc.modalOverlay }}>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl w-full max-w-md p-6"
        style={{ background: tc.modalBg, border: '1px solid ' + tc.btnDangerBorder }}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full" style={{ background: tc.statusOverdue.bg }}>
            <AlertTriangle className="h-6 w-6" style={{ color: tc.statusOverdue.text }} aria-hidden="true" />
          </div>
          <div className="mt-0 text-left">
            <h3 className="text-lg leading-6 font-medium" style={{ color: tc.textPrimary }}>
              Delete User
            </h3>
            <div className="mt-2">
              <p className="text-[13px]" style={{ color: tc.textMuted }}>
                Are you sure you want to delete <span className="font-bold" style={{ color: tc.textPrimary }}>{user.name}</span>? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-row-reverse gap-3">
          <button
            type="button"
            className="inline-flex justify-center rounded-lg px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
            style={{ background: tc.btnDangerBg, color: tc.btnDangerText, border: '1px solid ' + tc.btnDangerBorder }}
            onClick={handleConfirm}
            disabled={isDeleting}
            onMouseEnter={(e) => e.currentTarget.style.background = tc.btnDangerHoverBg}
            onMouseLeave={(e) => e.currentTarget.style.background = tc.btnDangerBg}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            type="button"
            className="inline-flex justify-center rounded-lg px-4 py-2 text-[13px] font-medium transition-colors"
            style={{ background: tc.btnSecondaryBg, color: tc.btnSecondaryText, border: '1px solid ' + tc.btnSecondaryBorder }}
            onClick={onClose}
            onMouseEnter={(e) => e.currentTarget.style.background = tc.btnSecondaryHoverBg}
            onMouseLeave={(e) => e.currentTarget.style.background = tc.btnSecondaryBg}
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
  const tc = useThemeColors()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

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

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 rounded-full border-2 border-transparent" style={{ borderTopColor: 'rgb(16,185,129)', borderRightColor: 'rgba(16,185,129,0.3)' }} />
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgb(239,68,68)' }} />
        <p className="text-[13px] mb-4" style={{ color: tc.textMuted }}>{error}</p>
        <button
          onClick={fetchUsers}
          className="px-5 py-2 text-[13px] rounded-lg font-medium"
          style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: '1px solid ' + tc.btnPrimaryBorder }}
        >
          Retry
        </button>
      </div>
    </div>
  )

  return (
    <>
      <div className="max-w-[1100px] mx-auto relative z-10 pb-8">
        {/* Page Header */}
        <div className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4" style={{ color: 'rgb(16,185,129)' }} />
                <p className="text-[13px] font-medium tracking-wide uppercase" style={{ color: tc.accentLabel }}>Team Management</p>
              </div>
              <h1 className="text-[26px] sm:text-[32px] font-bold tracking-tight mb-1" style={{ color: tc.textPrimary }}>User Management</h1>
              <p className="text-[15px]" style={{ color: tc.textMuted }}>Add, edit, or remove users.</p>
            </div>
            <button
              onClick={() => { setEditingUser({}); setIsModalOpen(true); }}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors w-full sm:w-auto flex-shrink-0"
              style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: '1px solid ' + tc.btnPrimaryBorder }}
              onMouseEnter={(e) => e.currentTarget.style.background = tc.btnPrimaryHoverBg}
              onMouseLeave={(e) => e.currentTarget.style.background = tc.btnPrimaryBg}
            >
              <UserPlus className="w-4 h-4" />
              Add User
            </button>
          </div>
        </div>

        {/* Users Table */}
        <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.08 }}>
          <div className="rounded-xl overflow-x-auto" style={{ background: tc.tableBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}>
            <table className="min-w-[640px] sm:min-w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: tc.tableHeaderBg }}>
                  <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: tc.textMuted, borderBottom: '1px solid ' + tc.tableDivider }}>Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: tc.textMuted, borderBottom: '1px solid ' + tc.tableDivider }}>Role</th>
                  <th scope="col" className="relative px-6 py-3" style={{ borderBottom: '1px solid ' + tc.tableDivider }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => (
                  <tr
                    key={user.id}
                    style={{
                      background: hoveredRow === user.id ? tc.hoverRow : 'transparent',
                      borderBottom: i < users.length - 1 ? '1px solid ' + tc.tableDivider : 'none',
                    }}
                    onMouseEnter={() => setHoveredRow(user.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap" style={{ borderBottom: i < users.length - 1 ? '1px solid ' + tc.tableDivider : 'none' }}>
                      <div className="text-[13px] font-medium" style={{ color: tc.textPrimary }}>{user.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="text-[12px]" style={{ color: tc.textMuted }}>{user.email}</div>
                        {user.isBlocked && (!user.temporaryUnblockUntil || new Date(user.temporaryUnblockUntil) < new Date()) && (
                          <span
                            className="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                            style={{ background: tc.statusOverdue.bg, color: tc.statusOverdue.text, border: '1px solid ' + tc.statusOverdue.border }}
                          >
                            Blocked
                          </span>
                        )}
                        {user.forcePasswordChange && (
                          <span
                            className="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                            style={{ background: tc.statusPending.bg, color: tc.statusPending.text, border: '1px solid ' + tc.statusPending.border }}
                          >
                            Pwd change req
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" style={{ borderBottom: i < users.length - 1 ? '1px solid ' + tc.tableDivider : 'none' }}>
                      {user.isAdmin ? (
                        <span
                          className="px-2.5 py-0.5 inline-flex text-[11px] leading-5 font-semibold rounded-full"
                          style={{ background: tc.statusCompleted.bg, color: tc.statusCompleted.text, border: '1px solid ' + tc.statusCompleted.border }}
                        >
                          Admin
                        </span>
                      ) : (
                        <span
                          className="px-2.5 py-0.5 inline-flex text-[11px] leading-5 font-semibold rounded-full"
                          style={{ background: tc.btnSecondaryBg, color: tc.btnSecondaryText, border: '1px solid ' + tc.btnSecondaryBorder }}
                        >
                          Cleaner
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" style={{ borderBottom: i < users.length - 1 ? '1px solid ' + tc.tableDivider : 'none' }}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingUser(user); setIsModalOpen(true); }}
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: tc.textMuted }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = tc.btnPrimaryText; e.currentTarget.style.background = tc.btnPrimaryBg }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted; e.currentTarget.style.background = 'transparent' }}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
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
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                            style={{ color: tc.btnDangerText, background: tc.btnDangerBg, border: '1px solid ' + tc.btnDangerBorder }}
                            onMouseEnter={(e) => e.currentTarget.style.background = tc.btnDangerHoverBg}
                            onMouseLeave={(e) => e.currentTarget.style.background = tc.btnDangerBg}
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
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                            style={{ color: tc.btnDangerText, background: tc.btnDangerBg, border: '1px solid ' + tc.btnDangerBorder }}
                            onMouseEnter={(e) => e.currentTarget.style.background = tc.btnDangerHoverBg}
                            onMouseLeave={(e) => e.currentTarget.style.background = tc.btnDangerBg}
                          >
                            Block
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingUser(user)}
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: tc.textMuted }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = tc.btnDangerText; e.currentTarget.style.background = tc.btnDangerBg }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted; e.currentTarget.style.background = 'transparent' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isModalOpen && <UserFormModal user={editingUser} onClose={() => setIsModalOpen(false)} onSave={handleSaveUser} tc={tc} />}
        {deletingUser && <DeleteConfirmationModal user={deletingUser} onClose={() => setDeletingUser(null)} onConfirm={handleDeleteUser} tc={tc} />}
      </AnimatePresence>
    </>
  )
}
