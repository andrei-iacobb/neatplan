'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit, Trash2, X, AlertTriangle, Building2, Sparkles, Users as UsersIcon, DoorOpen } from 'lucide-react'
import { useToast } from '@/components/ui/toast-context'
import { apiRequest } from '@/lib/url-utils'
import { useThemeColors } from '@/hooks/useThemeColors'
import { canAccessAllSites } from '@/lib/roles'

const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  address: z.string().optional(),
  description: z.string().optional(),
})

type SiteFormData = z.infer<typeof siteSchema>

interface Site {
  id: string
  name: string
  address?: string | null
  description?: string | null
  _count?: { users: number; rooms: number }
}

type ThemeColors = ReturnType<typeof useThemeColors>

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

function SiteFormModal({ site, onClose, onSave, tc }: { site: Partial<Site> | null, onClose: () => void, onSave: (data: SiteFormData) => Promise<void>, tc: ThemeColors }) {
  const { showToast } = useToast()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: site?.name || '',
      address: site?.address || '',
      description: site?.description || '',
    },
  })

  const onSubmit = async (data: SiteFormData) => {
    try {
      await onSave(data)
      onClose()
    } catch (error: any) {
      showToast(error.message || 'Failed to save site.', 'error')
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
            <h2 className="text-xl font-semibold" style={{ color: tc.textPrimary }}>{site?.id ? 'Edit Site' : 'Add New Site'}</h2>
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
                placeholder="Site name"
                className="w-full p-2.5 rounded-lg text-[14px] outline-none transition-colors"
                style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
              />
              {errors.name && <p className="text-[12px] mt-1" style={{ color: tc.statusOverdue.text }}>{errors.name.message}</p>}
            </div>

            <div>
              <input
                {...register('address')}
                placeholder="Address (optional)"
                className="w-full p-2.5 rounded-lg text-[14px] outline-none transition-colors"
                style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
              />
              {errors.address && <p className="text-[12px] mt-1" style={{ color: tc.statusOverdue.text }}>{errors.address.message}</p>}
            </div>

            <div>
              <textarea
                {...register('description')}
                placeholder="Description (optional)"
                rows={3}
                className="w-full p-2.5 rounded-lg text-[14px] outline-none transition-colors resize-none"
                style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
              />
              {errors.description && <p className="text-[12px] mt-1" style={{ color: tc.statusOverdue.text }}>{errors.description.message}</p>}
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

function DeleteConfirmationModal({ site, onClose, onConfirm, tc }: { site: Site, onClose: () => void, onConfirm: () => Promise<void>, tc: ThemeColors }) {
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
              Delete Site
            </h3>
            <div className="mt-2">
              <p className="text-[13px]" style={{ color: tc.textMuted }}>
                Are you sure you want to delete <span className="font-bold" style={{ color: tc.textPrimary }}>{site.name}</span>? This also removes its rooms, equipment, and schedules, and unassigns its users. This action cannot be undone.
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

export default function SitesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const tc = useThemeColors()
  const [sites, setSites] = useState<Site[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<Partial<Site> | null>(null)
  const [deletingSite, setDeletingSite] = useState<Site | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  // Only OP/DIRECTOR may create, edit or delete sites. MANAGER can view (read-only).
  const canManage = canAccessAllSites(session?.user?.role)

  const fetchSites = async () => {
    setIsLoading(true)
    try {
      const res = await apiRequest('/api/sites')
      if (!res.ok) throw new Error('Failed to fetch sites')
      const data = await res.json()
      setSites(data)
    } catch (e: any) {
      showToast(e.message || 'Failed to load sites', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      if (!session?.user?.isAdmin) {
        router.replace('/clean')
      } else {
        fetchSites()
      }
    }
  }, [status, session, router])

  const handleSaveSite = async (data: SiteFormData) => {
    const isEditing = !!editingSite?.id
    const url = isEditing ? `/api/sites/${editingSite.id}` : '/api/sites'
    const method = isEditing ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const errorData = await res.json()
      throw new Error(errorData.error || 'Failed to save site')
    }

    showToast(`Site ${isEditing ? 'updated' : 'created'} successfully.`, 'success')

    setIsModalOpen(false)
    setEditingSite(null)
    fetchSites()
  }

  const handleDeleteSite = async () => {
    if (!deletingSite) return

    try {
      const res = await apiRequest(`/api/sites/${deletingSite.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to delete site.')
      }
      showToast('Site deleted successfully.', 'success')
      setDeletingSite(null)
      fetchSites()
    } catch (e: any) {
      showToast(e.message, 'error')
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 rounded-full border-2 border-transparent" style={{ borderTopColor: 'rgb(16,185,129)', borderRightColor: 'rgba(16,185,129,0.3)' }} />
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
                <p className="text-[13px] font-medium tracking-wide uppercase" style={{ color: tc.accentLabel }}>Site Management</p>
              </div>
              <h1 className="text-[26px] sm:text-[32px] font-bold tracking-tight mb-1" style={{ color: tc.textPrimary }}>Sites</h1>
              <p className="text-[15px]" style={{ color: tc.textMuted }}>
                {canManage ? 'Add, edit, or remove the sites your team looks after.' : 'The site you are assigned to.'}
              </p>
            </div>
            {canManage && (
              <button
                onClick={() => { setEditingSite({}); setIsModalOpen(true); }}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors w-full sm:w-auto flex-shrink-0"
                style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: '1px solid ' + tc.btnPrimaryBorder }}
                onMouseEnter={(e) => e.currentTarget.style.background = tc.btnPrimaryHoverBg}
                onMouseLeave={(e) => e.currentTarget.style.background = tc.btnPrimaryBg}
              >
                <Plus className="w-4 h-4" />
                Add Site
              </button>
            )}
          </div>
        </div>

        {sites.length === 0 ? (
          <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.08 }}
            className="rounded-xl p-10 text-center" style={{ background: tc.tableBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}>
            <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: tc.textMuted }} />
            <p className="text-[14px] font-medium mb-1" style={{ color: tc.textPrimary }}>No sites yet</p>
            <p className="text-[13px]" style={{ color: tc.textMuted }}>
              {canManage ? 'Create your first site to start assigning rooms and staff.' : 'You have not been assigned to a site yet.'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sites.map((site, i) => (
              <motion.div
                key={site.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.08 + i * 0.04 }}
                className="rounded-xl p-5 relative transition-colors duration-200"
                style={{ background: tc.cardBg, border: '1px solid ' + (hoveredRow === site.id ? 'rgba(16,185,129,0.4)' : tc.cardBorder), boxShadow: tc.shadow }}
                onMouseEnter={() => setHoveredRow(site.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', color: 'rgb(16,185,129)' }}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold truncate" style={{ color: tc.textPrimary }}>{site.name}</h3>
                      <p className="text-[12px] mt-0.5 truncate" style={{ color: site.address ? tc.textSecondary : tc.textMuted }}>{site.address || 'No address set'}</p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        aria-label="Edit site"
                        onClick={() => { setEditingSite(site); setIsModalOpen(true); }}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: tc.textMuted }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = tc.btnPrimaryText; e.currentTarget.style.background = tc.btnPrimaryBg }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted; e.currentTarget.style.background = 'transparent' }}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        aria-label="Delete site"
                        onClick={() => setDeletingSite(site)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: tc.textMuted }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = tc.btnDangerText; e.currentTarget.style.background = tc.btnDangerBg }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted; e.currentTarget.style.background = 'transparent' }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {site.description && (
                  <p className="text-[12px] mt-3 line-clamp-2" style={{ color: tc.textSecondary }}>{site.description}</p>
                )}
                <div className="flex items-center gap-4 mt-4 pt-4 text-[12px]" style={{ borderTop: '1px solid ' + tc.divider, color: tc.textMuted }}>
                  <span className="inline-flex items-center gap-1.5"><UsersIcon className="w-4 h-4" />{site._count?.users ?? 0} {(site._count?.users ?? 0) === 1 ? 'member' : 'members'}</span>
                  <span className="inline-flex items-center gap-1.5"><DoorOpen className="w-4 h-4" />{site._count?.rooms ?? 0} {(site._count?.rooms ?? 0) === 1 ? 'room' : 'rooms'}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && canManage && <SiteFormModal site={editingSite} onClose={() => setIsModalOpen(false)} onSave={handleSaveSite} tc={tc} />}
        {deletingSite && canManage && <DeleteConfirmationModal site={deletingSite} onClose={() => setDeletingSite(null)} onConfirm={handleDeleteSite} tc={tc} />}
      </AnimatePresence>
    </>
  )
}
