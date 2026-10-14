import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://nutrisafe:nutrisafe@localhost:5432/nutrisafe?schema=public",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "nutrisafesupersecretkey123",
  TOKEN_HASH_PEPPER: process.env.TOKEN_HASH_PEPPER || "nutrisafepepperkey123",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  APP_URL: process.env.APP_URL || "http://localhost:3000",
  NODE_ENV: process.env.NODE_ENV || 'development',
  TRUST_PROXY: process.env.TRUST_PROXY === 'true' || true,
  ACCESS_TTL_SECONDS: Number(process.env.ACCESS_TTL_SECONDS) || 900,
  corsOrigins: (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "http://localhost:5173").split(','),
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE || 'lax',
  REFRESH_TTL_DAYS: Number(process.env.REFRESH_TTL_DAYS) || 7,
};

export const isProd = process.env.NODE_ENV === 'production';