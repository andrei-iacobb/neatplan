import nodemailer from 'nodemailer'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

interface EmailNotification {
  to: string
  subject: string
  type: 'task_reminder' | 'schedule_update' | 'system_alert' | 'completion_notice'
  data?: any
}

// Email templates
const templates = {
  task_reminder: {
    subject: 'Task Reminder - NeatPlan',
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0D9488;">Task Reminder</h2>
        <p>Hello ${data.userName},</p>
        <p>You have an upcoming cleaning task:</p>
        <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0; color: #0369a1;">${data.taskName}</h3>
          <p style="margin: 0; color: #64748b;">Room: ${data.roomName}</p>
          <p style="margin: 0; color: #64748b;">Due: ${data.dueDate}</p>
        </div>
        <p>Please complete this task on time.</p>
        <p>Best regards,<br>NeatPlan Team</p>
      </div>
    `
  },
  schedule_update: {
    subject: 'Schedule Update - NeatPlan',
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0D9488;">Schedule Update</h2>
        <p>Hello ${data.userName},</p>
        <p>Your cleaning schedule has been updated:</p>
        <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0; color: #0369a1;">${data.changeType}</h3>
          <p style="margin: 0; color: #64748b;">${data.description}</p>
          ${data.newDate ? `<p style="margin: 0; color: #64748b;">New Date: ${data.newDate}</p>` : ''}
        </div>
        <p>Please check your dashboard for the latest schedule.</p>
        <p>Best regards,<br>NeatPlan Team</p>
      </div>
    `
  },
  system_alert: {
    subject: 'System Alert - NeatPlan',
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #DC2626;">System Alert</h2>
        <p>Hello ${data.userName},</p>
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #DC2626;">
          <h3 style="margin: 0 0 8px 0; color: #DC2626;">${data.alertType}</h3>
          <p style="margin: 0; color: #7f1d1d;">${data.message}</p>
        </div>
        <p>Please take appropriate action if required.</p>
        <p>Best regards,<br>NeatPlan Team</p>
      </div>
    `
  },
  completion_notice: {
    subject: 'Task Completed - NeatPlan',
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Task Completed</h2>
        <p>Hello ${data.userName},</p>
        <p>Great work! A cleaning task has been completed:</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0; color: #059669;">${data.taskName}</h3>
          <p style="margin: 0; color: #15803d;">Room: ${data.roomName}</p>
          <p style="margin: 0; color: #15803d;">Completed by: ${data.completedBy}</p>
          <p style="margin: 0; color: #15803d;">Completed at: ${data.completedAt}</p>
        </div>
        <p>Thank you for maintaining our cleaning standards!</p>
        <p>Best regards,<br>NeatPlan Team</p>
      </div>
    `
  }
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private isConfigured = false

  constructor() {
    this.initializeTransporter()
  }

  private async initializeTransporter() {
    try {
      // Try to use environment variables for email configuration
      const emailConfig: EmailConfig = {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || ''
        }
      }

      // If no SMTP config, use Ethereal for testing
      if (!process.env.SMTP_HOST) {
        const testAccount = await nodemailer.createTestAccount()
        emailConfig.host = 'smtp.ethereal.email'
        emailConfig.port = 587
        emailConfig.secure = false
        emailConfig.auth = {
          user: testAccount.user,
          pass: testAccount.pass
        }
        console.log('Using Ethereal email for testing:', testAccount.user)
      }

      this.transporter = nodemailer.createTransport(emailConfig)
      
      // Verify connection
      await this.transporter.verify()
      this.isConfigured = true
      console.log('Email service initialized successfully')
    } catch (error) {
      console.error('Email service initialization failed:', error)
      this.isConfigured = false
    }
  }

  async sendNotification(notification: EmailNotification): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      console.warn('Email service not configured, skipping notification')
      return false
    }

    try {
      const template = templates[notification.type]
      if (!template) {
        throw new Error(`Unknown notification type: ${notification.type}`)
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || 'NeatPlan <noreply@neatplan.com>',
        to: notification.to,
        subject: notification.subject || template.subject,
        html: template.html(notification.data || {})
      }

      const info = await this.transporter.sendMail(mailOptions)
      
      // Log preview URL for Ethereal
      if (process.env.NODE_ENV !== 'production') {
        console.log('Email sent:', nodemailer.getTestMessageUrl(info))
      }
      
      return true
    } catch (error) {
      console.error('Failed to send email notification:', error)
      return false
    }
  }

  async sendTaskReminder(userEmail: string, taskData: {
    userName: string
    taskName: string
    roomName: string
    dueDate: string
  }): Promise<boolean> {
    return this.sendNotification({
      to: userEmail,
      subject: 'Task Reminder - NeatPlan',
      type: 'task_reminder',
      data: taskData
    })
  }

  async sendScheduleUpdate(userEmail: string, updateData: {
    userName: string
    changeType: string
    description: string
    newDate?: string
  }): Promise<boolean> {
    return this.sendNotification({
      to: userEmail,
      subject: 'Schedule Update - NeatPlan',
      type: 'schedule_update',
      data: updateData
    })
  }

  async sendSystemAlert(userEmail: string, alertData: {
    userName: string
    alertType: string
    message: string
  }): Promise<boolean> {
    return this.sendNotification({
      to: userEmail,
      subject: 'System Alert - NeatPlan',
      type: 'system_alert',
      data: alertData
    })
  }

  async sendCompletionNotice(userEmail: string, completionData: {
    userName: string
    taskName: string
    roomName: string
    completedBy: string
    completedAt: string
  }): Promise<boolean> {
    return this.sendNotification({
      to: userEmail,
      subject: 'Task Completed - NeatPlan',
      type: 'completion_notice',
      data: completionData
    })
  }

  isReady(): boolean {
    return this.isConfigured
  }
}

// Singleton instance
export const emailService = new EmailService()

// Helper function to send notifications based on user preferences
export async function sendNotificationIfEnabled(
  userEmail: string,
  userSettings: { notifications: { email: boolean } },
  notificationType: EmailNotification['type'],
  data: any
): Promise<boolean> {
  if (!userSettings.notifications.email) {
    console.log('Email notifications disabled for user:', userEmail)
    return false
  }

  return emailService.sendNotification({
    to: userEmail,
    subject: '',
    type: notificationType,
    data
  })
} 