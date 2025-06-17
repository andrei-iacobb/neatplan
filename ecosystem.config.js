module.exports = {
  apps: [{
    name: 'cleantrack',
    script: 'npm',
    args: 'start',
    cwd: process.cwd(),
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    log_file: './logs/app.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Windows specific settings
    windowsHide: true,
    kill_timeout: 5000,
    listen_timeout: 8000,
    // Auto restart on crash
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000
  }]
} 