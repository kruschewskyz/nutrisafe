import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://nutrisafe:nutrisafe@localhost:5432/nutrisafe?schema=public",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "nutrisafesupersecretkey123",
  TOKEN_HASH_PEPPER: process.env.TOKEN_HASH_PEPPER || "nutrisafepepperkey123",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  APP_URL: process.env.APP_URL || "http://localhost:3000",
};

export const isProd = process.env.NODE_ENV === 'production';