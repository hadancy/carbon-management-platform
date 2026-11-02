export function databasePoolConfig() {
  function value(name: string, fallback: number, maximum: number) {
    const input = process.env[name];
    const parsed = input === undefined ? fallback : Number(input);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum)
      throw Error(`${name} must be an integer between 1 and ${maximum}`);
    return parsed;
  }
  return {
    max: value("DB_POOL_MAX", 10, 100),
    connectionTimeoutMillis: value("DB_CONNECTION_TIMEOUT_MS", 10000, 60000),
    idleTimeoutMillis: value("DB_IDLE_TIMEOUT_MS", 30000, 300000),
  };
}
