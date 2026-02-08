import {
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsArray,
} from "class-validator";
import { OrderStatus } from "@prisma/client";

export class CreateOrderDto {
  @IsOptional()
  @IsNumber()
  total?: number;

  @IsOptional()
  @IsNumber()
  shipping?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  companyConfirm?: boolean;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsNumber()
  deliveryId?: number;

  @IsOptional()
  @IsNumber()
  clientId?: number;
}

export class updateOrdersDto {
  @IsOptional()
  @IsNumber()
  total?: number;

  @IsOptional()
  @IsNumber()
  shipping?: number;

  @IsOptional()
  @IsBoolean()
  companyConfirm?: boolean;

  @IsOptional()
  @IsBoolean()
  deliveryConfirm?: boolean;

  @IsArray()
  ids: number[];
}

export class CreateOrderByClientDto {
  @IsString()
  notes?: string;

  @IsString()
  to?: string;

  @IsString()
  from?: string;

  @IsString()
  key?: string;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsNumber()
  total?: number;

  @IsOptional()
  @IsNumber()
  shipping?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  companyConfirm?: boolean;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsNumber()
  deliveryId?: number;

  @IsOptional()
  @IsNumber()
  clientId?: number;
}
