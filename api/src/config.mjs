export function getConfig() {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 8080),
    apiDataSource: process.env.API_DATA_SOURCE ?? 'fixtures',
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? '',
    storageEndpoint: process.env.STORAGE_ENDPOINT ?? '',
    storageBucket: process.env.STORAGE_BUCKET ?? '',
    storageAccessKey: process.env.STORAGE_ACCESS_KEY ?? '',
    storageSecretKey: process.env.STORAGE_SECRET_KEY ?? '',
    webhookUrl: process.env.WEBHOOK_URL ?? '',
    webhookSecret: process.env.WEBHOOK_SECRET ?? '',
    webhookEvents: process.env.WEBHOOK_EVENTS ?? '',
    webhookTimeoutMs: Number(process.env.WEBHOOK_TIMEOUT_MS ?? 5000),
  };
}
