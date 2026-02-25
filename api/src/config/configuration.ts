export default () => ({
  port: parseInt(process.env.PORT ?? "3001", 10),
  database: {
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "3306", 10),
    username: process.env.DB_USER ?? "root",
    password: process.env.DB_PASS ?? "",
    database: process.env.DB_NAME ?? "bfp_sorsogon_attendance",
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? "dev-jwt-secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-jwt-refresh-secret",
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? "15m",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? "7d",
  },
  faceServiceUrl: process.env.FACE_SERVICE_URL ?? "http://localhost:5001",
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",").map((o) =>
    o.trim(),
  ) ?? ["http://localhost:3000"],
});
