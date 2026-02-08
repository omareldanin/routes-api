import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";

const toBoolean = ({ value }: { value: any }) => {
  if (value === true || value === false) return value;

  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
    if (v === "1") return true;
    if (v === "0") return false;
    if (v === "on") return true;
    if (v === "off") return false;
  }

  return value; // let validation fail if it's something else
};

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  shippingValue?: number;

  @IsOptional()
  @IsString()
  activeShipping?: string;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  shippingValue?: number;

  @IsOptional()
  @IsString()
  activeShipping?: string;
}
