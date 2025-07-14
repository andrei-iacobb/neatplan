import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

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

const CONFIG_FILE = path.join(process.cwd(), '.smtp-config.json')

// Helper to check if user is admin
async function isAdmin(request: NextRequest) {
  const session = await getServerSession(authOptions)
  return session?.user && (session.user as any).isAdmin
}

// GET - Load SMTP configuration
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let config: Partial<SMTPConfig> = {}

    // Try to read from file first
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const fileContent = fs.readFileSync(CONFIG_FILE, 'utf8')
        config = JSON.parse(fileContent)
      }
    } catch (fileError) {
      console.warn('Could not read SMTP config file:', fileError)
    }

    // Merge with environment variables (env vars take precedence)
    const envConfig: Partial<SMTPConfig> = {
      host: process.env.SMTP_HOST || config.host || '',
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : config.port || 587,
      secure: process.env.SMTP_SECURE === 'true' || config.secure || false,
      user: process.env.SMTP_USER || config.user || '',
      pass: process.env.SMTP_PASS || config.pass || '',
      from: process.env.SMTP_FROM || config.from || '',
      enabled: config.enabled || false
    }

    // Don't send the password in the response for security
    const responseConfig = {
      ...envConfig,
      pass: envConfig.pass ? '••••••••••••' : ''
    }

    return NextResponse.json(responseConfig)

  } catch (error) {
    console.error('SMTP config GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Save SMTP configuration
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config: SMTPConfig = await request.json()

    // Validate required fields if enabled
    if (config.enabled) {
      if (!config.host || !config.user || !config.from) {
        return NextResponse.json(
          { error: 'Host, user, and from address are required when email is enabled' },
          { status: 400 }
        )
      }

      if (!config.pass || config.pass === '••••••••••••') {
        // Don't save if password is placeholder, load existing password
        try {
          if (fs.existsSync(CONFIG_FILE)) {
            const existingConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
            config.pass = existingConfig.pass || ''
          }
        } catch (error) {
          return NextResponse.json(
            { error: 'Password is required' },
            { status: 400 }
          )
        }
      }

      // Validate port
      if (config.port < 1 || config.port > 65535) {
        return NextResponse.json(
          { error: 'Port must be between 1 and 65535' },
          { status: 400 }
        )
      }

      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(config.user)) {
        return NextResponse.json(
          { error: 'Invalid email format for username' },
          { status: 400 }
        )
      }

      // Extract email from "Name <email>" format for 'from' field
      const fromEmailMatch = config.from.match(/<([^>]+)>/) || [null, config.from]
      const fromEmail = fromEmailMatch[1] || config.from
      if (!emailRegex.test(fromEmail)) {
        return NextResponse.json(
          { error: 'Invalid email format for from address' },
          { status: 400 }
        )
      }
    }

    // Save configuration to file
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
    } catch (writeError) {
      console.error('Failed to write SMTP config:', writeError)
      return NextResponse.json(
        { error: 'Failed to save configuration' },
        { status: 500 }
      )
    }

    // Update environment variables for current session
    process.env.SMTP_HOST = config.host
    process.env.SMTP_PORT = config.port.toString()
    process.env.SMTP_SECURE = config.secure.toString()
    process.env.SMTP_USER = config.user
    process.env.SMTP_PASS = config.pass
    process.env.SMTP_FROM = config.from

    return NextResponse.json({ 
      message: 'SMTP configuration saved successfully',
      enabled: config.enabled 
    })

  } catch (error) {
    console.error('SMTP config POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Reset SMTP configuration
export async function DELETE(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Remove config file
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE)
      }
    } catch (error) {
      console.warn('Could not delete SMTP config file:', error)
    }

    // Clear environment variables
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.SMTP_SECURE
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
    delete process.env.SMTP_FROM

    return NextResponse.json({ message: 'SMTP configuration reset successfully' })

  } catch (error) {
    console.error('SMTP config DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 