import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  isNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { UserRole, Permissions } from "@prisma/client";

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  latitude?: string;

  @IsOptional()
  companyId?: number;

  @IsOptional()
  @IsString()
  longitudes?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsEnum(Permissions, { each: true })
  permissions: Permissions[];

  @IsOptional()
  @IsDateString()
  supscriptionStartDate?: string;

  @IsOptional()
  @IsDateString()
  supscriptionEndDate?: string;

  @IsOptional()
  @IsString()
  worksFroms?: string;

  @IsOptional()
  @IsString()
  worksTo?: string;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  phone: string;

  @IsString()
  @IsOptional()
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsOptional()
  @IsString()
  fcm?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  latitude?: string;

  @IsOptional()
  @IsString()
  online?: string;

  @IsOptional()
  @IsString()
  longitudes?: string;

  @IsOptional()
  @IsEnum(Permissions, { each: true })
  permissions: Permissions[];

  @IsOptional()
  @IsDateString()
  supscriptionStartDate?: string;

  @IsOptional()
  @IsDateString()
  supscriptionEndDate?: string;

  @IsOptional()
  @IsInt()
  min?: number;

  @IsOptional()
  @IsInt()
  max?: number;

  @IsOptional()
  @IsInt()
  deliveryPrecent?: number;

  @IsOptional()
  @IsString()
  confirmOrders?: string;

  @IsOptional()
  @IsString()
  worksFroms?: string;

  @IsOptional()
  @IsString()
  worksTo?: string;
}
