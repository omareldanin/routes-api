import * as dotenv from "dotenv";
import z from "zod";

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().min(1).max(65535),
  NODE_ENV: z.enum(["production", "development"]),
  PASSWORD_SALT: z.string().min(1),
  ACCESS_TOKEN_SECRET: z.string().min(1),
  ACCESS_TOKEN_EXPIRES_IN: z.string().min(1),
  REFRESH_TOKEN_SECRET: z.string().min(1),
  REFRESH_TOKEN_EXPIRES_IN: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_USER: z.string().min(1),
  DATABASE_URL: z.string().min(1).url(),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  DO_SPACES_BUCKET_NAME: z.string().min(1),
  DO_SPACES_REGION: z.string().min(1),
  DO_SPACES_ENDPOINT: z.string().min(1),
  DO_SPACES_KEY: z.string().min(1),
  DO_SPACES_SECRET: z.string().min(1),
});

export const env = schema.parse(process.env);
