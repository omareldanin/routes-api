import { IsNumber, IsOptional, IsString, IsEnum } from "class-validator";
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
  @IsString()
  to?: string;

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
