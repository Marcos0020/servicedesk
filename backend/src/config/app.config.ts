export const appConfig = () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  storagePath: process.env.STORAGE_PATH || './storage',
  backupPath: process.env.BACKUP_PATH || './backups',
  emailCheckIntervalMinutes: parseInt(process.env.EMAIL_CHECK_INTERVAL_MINUTES, 10) || 5,
  backupCron: process.env.BACKUP_CRON || '0 2 * * *', // Daily at 2 AM
  oracle: {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECTION_STRING,
    poolMin: parseInt(process.env.ORACLE_POOL_MIN, 10) || 2,
    poolMax: parseInt(process.env.ORACLE_POOL_MAX, 10) || 10,
    poolIncrement: 1,
  },
  gmail: {
    user: process.env.GMAIL_USER,
    password: process.env.GMAIL_APP_PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
  },
});
