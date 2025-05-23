'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

interface ScheduleDialogProps {
  onScheduleCreated: () => void
}

export function ScheduleDialog({ onScheduleCreated }: ScheduleDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [frequency, setFrequency] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          frequency: frequency.trim() || null,
          tasks: [] 
        })
      })

      if (!response.ok) throw new Error('Failed to create schedule')
      
      toast.success('Schedule created')
      setOpen(false)
      setTitle('')
      setFrequency('')
      onScheduleCreated()
    } catch (error) {
      toast.error('Failed to create schedule')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-gray-100">Create New Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Schedule Title</label>
              <Input
                placeholder="e.g., Weekly Kitchen Cleaning"
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={isLoading}
                className="bg-gray-800/50 border-gray-700 text-gray-100 placeholder:text-gray-500 focus:border-gray-600"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Frequency</label>
              <Input
                placeholder="e.g., Daily, Weekly, Monthly"
                value={frequency}
                onChange={e => setFrequency(e.target.value)}
                disabled={isLoading}
                className="bg-gray-800/50 border-gray-700 text-gray-100 placeholder:text-gray-500 focus:border-gray-600"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
              className="bg-transparent border-gray-700 hover:bg-gray-800 hover:border-gray-600"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-gray-200 text-gray-900 hover:bg-gray-300 transition-colors"
            >
              {isLoading ? 'Creating...' : 'Create Schedule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 