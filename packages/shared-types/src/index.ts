import { z } from "zod";

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  companyName: z.string().min(1),
});
export type SignupDto = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  schema: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  tenant: TenantInfo;
}

export type Role = "owner" | "manager" | "staff";

export interface ApiError {
  statusCode: number;
  message: string;
  code?: string;
}
