module.exports = {
  apps: [{
    name: 'neatplan',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: process.cwd(),
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      // Environment variables will be automatically loaded from .env.production
      // Thanks to our url-utils.ts, the app will work with any NEXTAUTH_URL you set
    },
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // Logging configuration for Windows Server 2022
    log_file: './logs/app.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Windows Server 2022 specific optimizations
    windowsHide: true,
    kill_timeout: 5000,
    listen_timeout: 8000,
    
    // Auto restart settings
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Performance settings for Windows Server
    node_args: '--max-old-space-size=2048'
  }]
} 