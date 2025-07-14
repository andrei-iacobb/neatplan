import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

interface SMTPConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
  enabled: boolean
}

// Helper to check if user is admin
async function isAdmin(request: NextRequest) {
  const session = await getServerSession(authOptions)
  return session?.user && (session.user as any).isAdmin
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config: SMTPConfig = await request.json()

    // Validate required fields
    if (!config.host || !config.user || !config.from) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Host, user, and from address are required' 
        },
        { status: 400 }
      )
    }

    // Create transporter with the provided config
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      },
      // Add some timeout settings
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000
    })

    try {
      // First, verify the connection
      await transporter.verify()
      
      // If verification succeeds, send a test email
      const testEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✅ SMTP Test Successful!</h1>
          </div>
          
          <div style="padding: 30px 20px; background: #f8fafc;">
            <h2 style="color: #1e293b; margin-top: 0;">Configuration Test Results</h2>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #0D9488; margin: 20px 0;">
              <h3 style="color: #0D9488; margin-top: 0;">✓ Connection Established</h3>
              <p style="color: #64748b; margin: 8px 0;">Successfully connected to your SMTP server</p>
              
              <div style="margin-top: 20px; font-size: 14px; color: #64748b;">
                <strong>Server:</strong> ${config.host}:${config.port}<br>
                <strong>Security:</strong> ${config.secure ? 'SSL/TLS' : 'STARTTLS'}<br>
                <strong>Authentication:</strong> ${config.user}<br>
                <strong>Test Time:</strong> ${new Date().toLocaleString()}
              </div>
            </div>
            
            <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #0369a1; margin-top: 0;">📧 Email Delivery Ready</h3>
              <p style="color: #0369a1; margin: 8px 0;">Your CleanTrack application can now send notifications:</p>
              <ul style="color: #0369a1; margin: 8px 0 0 20px;">
                <li>Task reminders</li>
                <li>Schedule updates</li>
                <li>System alerts</li>
                <li>Completion notices</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #64748b; font-size: 14px;">
                This email was sent automatically to test your SMTP configuration.<br>
                You can now safely enable email notifications in your CleanTrack settings.
              </p>
            </div>
          </div>
          
          <div style="background: #1e293b; padding: 20px; text-align: center;">
            <p style="color: #94a3b8; margin: 0; font-size: 14px;">
              © 2025 CleanTrack - Professional Cleaning Management System
            </p>
          </div>
        </div>
      `

      const info = await transporter.sendMail({
        from: config.from,
        to: session?.user?.email || config.user,
        subject: '🧹 CleanTrack SMTP Test - Configuration Successful!',
        html: testEmailHtml,
        text: `
CleanTrack SMTP Test - Configuration Successful!

✅ Connection Established
Successfully connected to your SMTP server: ${config.host}:${config.port}

📧 Email Delivery Ready
Your CleanTrack application can now send notifications:
- Task reminders
- Schedule updates  
- System alerts
- Completion notices

Test Details:
Server: ${config.host}:${config.port}
Security: ${config.secure ? 'SSL/TLS' : 'STARTTLS'}
Authentication: ${config.user}
Test Time: ${new Date().toLocaleString()}

This email was sent automatically to test your SMTP configuration.
You can now safely enable email notifications in your CleanTrack settings.
        `
      })

      // Log preview URL for development (if using Ethereal)
      if (process.env.NODE_ENV !== 'production' && info.messageId) {
        const previewUrl = nodemailer.getTestMessageUrl(info)
        if (previewUrl) {
          console.log('📧 Test email preview URL:', previewUrl)
        }
      }

      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${session?.user?.email || config.user}`,
        messageId: info.messageId,
        previewUrl: process.env.NODE_ENV !== 'production' ? nodemailer.getTestMessageUrl(info) : undefined
      })

    } catch (emailError: any) {
      console.error('SMTP test error:', emailError)
      
      // Provide specific error messages based on common issues
      let errorMessage = 'Failed to send test email'
      
      if (emailError.code === 'EAUTH') {
        errorMessage = 'Authentication failed. Please check your username and password.'
      } else if (emailError.code === 'ECONNECTION') {
        errorMessage = 'Could not connect to the SMTP server. Please check the host and port.'
      } else if (emailError.code === 'ETIMEDOUT') {
        errorMessage = 'Connection timed out. Please check your network and server settings.'
      } else if (emailError.code === 'ENOTFOUND') {
        errorMessage = 'SMTP server not found. Please check the hostname.'
      } else if (emailError.responseCode === 535) {
        errorMessage = 'Authentication failed. For Gmail, use App Password instead of your regular password.'
      } else if (emailError.responseCode === 587) {
        errorMessage = 'Port 587 connection failed. Try enabling STARTTLS or use port 465 with SSL.'
      } else if (emailError.message) {
        errorMessage = emailError.message
      }

      return NextResponse.json({
        success: false,
        message: errorMessage,
        details: emailError.code || emailError.responseCode || 'Unknown error',
        suggestions: getSuggestions(emailError, config)
      })
    }

  } catch (error) {
    console.error('SMTP test endpoint error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error occurred while testing SMTP configuration' 
      },
      { status: 500 }
    )
  }
}

function getSuggestions(error: any, config: SMTPConfig): string[] {
  const suggestions: string[] = []

  if (error.code === 'EAUTH' || error.responseCode === 535) {
    if (config.host.includes('gmail')) {
      suggestions.push('For Gmail: Enable 2-factor authentication and use an App Password')
      suggestions.push('Go to Google Account Settings → Security → App Passwords')
    } else if (config.host.includes('outlook') || config.host.includes('hotmail')) {
      suggestions.push('For Outlook: Use your Microsoft account credentials')
      suggestions.push('If 2FA is enabled, use an App Password')
    } else {
      suggestions.push('Verify your username and password are correct')
      suggestions.push('Check if your email provider requires App Passwords')
    }
  }

  if (error.code === 'ECONNECTION' || error.code === 'ENOTFOUND') {
    suggestions.push('Verify the SMTP hostname is correct')
    suggestions.push('Check if your firewall allows outbound connections on this port')
    suggestions.push('Try using a different port (587 for STARTTLS, 465 for SSL)')
  }

  if (error.responseCode === 587) {
    suggestions.push('Try enabling SSL/TLS if using port 465')
    suggestions.push('Try disabling SSL/TLS if using port 587')
  }

  return suggestions
} 