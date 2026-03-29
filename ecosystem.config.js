module.exports = {
  apps: [
    {
      name: 'neatplan',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 4040',
      cwd: process.cwd(),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4040,
      },

      // Auto restart
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 5000,

      // Logging
      log_file: './logs/app.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Windows Server
      windowsHide: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      node_args: '--max-old-space-size=2048',
    },

    // Cron: check overdue schedules every 15 minutes
    {
      name: 'neatplan-cron',
      script: 'scripts/cron-check-schedules.js',
      cwd: process.cwd(),
      cron_restart: '*/15 * * * *',
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      out_file: './logs/cron-out.log',
      error_file: './logs/cron-error.log',
      merge_logs: true,
      windowsHide: true,
    },
  ],
}
