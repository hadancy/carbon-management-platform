import { spawnSync } from "node:child_process";
export function postgresCommand(binary, args, databaseUrl) {
  const url = new URL(databaseUrl);
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    ...(url.searchParams.has("sslmode")
      ? { PGSSLMODE: url.searchParams.get("sslmode") }
      : {}),
  };
  const result = spawnSync(binary, args, {
    env,
    encoding: "utf8",
    timeout: 120000,
  });
  if (result.status !== 0)
    throw Error(
      `PostgreSQL tool failed (${result.status ?? result.error?.code ?? "unknown"}); check tool version, database permission and connectivity`,
    );
}
