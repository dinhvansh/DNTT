export function getConfig() {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 8080),
    apiDataSource: process.env.API_DATA_SOURCE ?? 'fixtures',
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? '',
    storageEndpoint: process.env.STORAGE_ENDPOINT ?? '',
    storageBucket: process.env.STORAGE_BUCKET ?? '',
  };
}
