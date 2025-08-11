import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { emailService } from '@/lib/email'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface EmailRequest {
  type: 'task_reminder' | 'schedule_update' | 'system_alert' | 'completion_notice'
  recipientEmail?: string
  recipientId?: string
  data: any
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: EmailRequest = await request.json()
    const { type, recipientEmail, recipientId, data } = body

    // Determine recipient
    let targetEmail = recipientEmail
    let targetUser = null

    if (recipientId) {
      targetUser = await prisma.user.findUnique({
        where: { id: recipientId }
      })
      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      // Use notification email if set, otherwise fallback to login email
      targetEmail = targetUser.email
    }

    if (!targetEmail) {
      return NextResponse.json({ error: 'No recipient specified' }, { status: 400 })
    }

    // Check if email service is ready
    if (!emailService.isReady()) {
      console.warn('Email service not configured')
      return NextResponse.json({ 
        message: 'Email service not configured',
        sent: false 
      }, { status: 200 })
    }

    // TODO: Check user notification preferences from database
    // For now, assume notifications are enabled
    const notificationsEnabled = true

    if (!notificationsEnabled) {
      return NextResponse.json({ 
        message: 'Email notifications disabled for user',
        sent: false 
      }, { status: 200 })
    }

    // Send notification based on type
    let success = false
    
    switch (type) {
      case 'task_reminder':
        success = await emailService.sendTaskReminder(targetEmail, {
          userName: data.userName || targetUser?.name || 'User',
          taskName: data.taskName,
          roomName: data.roomName,
          dueDate: data.dueDate
        })
        break

      case 'schedule_update':
        success = await emailService.sendScheduleUpdate(targetEmail, {
          userName: data.userName || targetUser?.name || 'User',
          changeType: data.changeType,
          description: data.description,
          newDate: data.newDate
        })
        break

      case 'system_alert':
        success = await emailService.sendSystemAlert(targetEmail, {
          userName: data.userName || targetUser?.name || 'User',
          alertType: data.alertType,
          message: data.message
        })
        break

      case 'completion_notice':
        success = await emailService.sendCompletionNotice(targetEmail, {
          userName: data.userName || targetUser?.name || 'User',
          taskName: data.taskName,
          roomName: data.roomName,
          completedBy: data.completedBy,
          completedAt: data.completedAt
        })
        break

      default:
        return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 })
    }

    return NextResponse.json({ 
      message: success ? 'Email sent successfully' : 'Failed to send email',
      sent: success,
      type,
      recipient: targetEmail
    })

  } catch (error) {
    console.error('Email notification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Test endpoint to send a sample notification
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as EmailRequest['type']
    let email = searchParams.get('email')

    // If no email provided, get user's notification email preference
    if (!email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })
      if (user) {
        email = user.email
      } else {
        email = session.user.email
      }
    }

    if (!type || !email) {
      return NextResponse.json({ 
        error: 'Missing required parameters: type, email' 
      }, { status: 400 })
    }

    // Send test notification
    const testData = {
      task_reminder: {
        userName: session.user.name || 'Test User',
        taskName: 'Clean Conference Room A',
        roomName: 'Conference Room A',
        dueDate: new Date().toLocaleDateString()
      },
      schedule_update: {
        userName: session.user.name || 'Test User',
        changeType: 'Schedule Modified',
        description: 'Your cleaning schedule has been updated',
        newDate: new Date().toLocaleDateString()
      },
      system_alert: {
        userName: session.user.name || 'Test User',
        alertType: 'Test Alert',
        message: 'This is a test system alert notification'
      },
      completion_notice: {
        userName: session.user.name || 'Test User',
        taskName: 'Clean Office Space',
        roomName: 'Office Space',
        completedBy: session.user.name || 'Test User',
        completedAt: new Date().toLocaleString()
      }
    }

    const success = await emailService.sendNotification({
      to: email,
      subject: `Test ${type} notification`,
      type,
      data: testData[type]
    })

    return NextResponse.json({ 
      message: success ? 'Test email sent successfully' : 'Failed to send test email',
      sent: success,
      type,
      recipient: email
    })

  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 