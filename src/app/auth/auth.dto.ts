import { UserRole } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface loginDto {
  phone: string;
  password: string;
  fcm: string | undefined;
}

export interface loginResponse {
  message: string;
  id: number;
  name: string | undefined;
  phone: string;
  avatar: string | undefined;
  wallet: Decimal;
  role: UserRole;
  token: string;
  refreshToken: string[];
}

export interface LoggedInUserType {
  id: number;
  name: string | undefined;
  phone: string;
  role: UserRole;
  superAdmin: boolean;
  iat: number;
  exp: number;
}
