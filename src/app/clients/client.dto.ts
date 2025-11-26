import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

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
}
