import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ClientsService } from "./clients.service";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "src/middlewares/jwt-auth.guard";
import { CreateClientDto, UpdateClientDto } from "./client.dto";
import { NoFilesInterceptor } from "@nestjs/platform-express";
import { PrismaService } from "src/prisma/prisma.service";

export interface LoggedInUserType {
  id: number;
  name: string | undefined;
  phone: string;
  role: UserRole;
  superAdmin: boolean;
  iat: number;
  exp: number;
}

@Controller("clients")
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private prisma: PrismaService
  ) {}

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(NoFilesInterceptor())
  @Post()
  async create(@Body() dto: CreateClientDto, @Req() req) {
    const loggedInUser = req.user as LoggedInUserType;
    return this.clientsService.create(dto, loggedInUser.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Req() req,
    @Query("code") code?: string,
    @Query("name") name?: string,
    @Query("phone") phone?: string,
    @Query("page") page = "1",
    @Query("size") size = "10"
  ) {
    const loggedInUser = req.user as LoggedInUserType;
    let companyId: number | undefined = undefined;

    if (loggedInUser.role === "COMPANY_ADMIN") {
      companyId = loggedInUser.id;
    }
    if (loggedInUser.role === "DELIVERY") {
      const user = await this.prisma.user.findUnique({
        where: {
          id: loggedInUser.id,
        },
        select: {
          company: {
            select: {
              id: true,
            },
          },
        },
      });
      companyId = user.company.id;
    }

    return this.clientsService.findAll(
      { code, name, phone },
      companyId,
      parseInt(page),
      parseInt(size)
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number, @Req() req) {
    const loggedInUser = req.user as LoggedInUserType;
    return this.clientsService.findOne(id, loggedInUser.id);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(NoFilesInterceptor())
  @Patch(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
    @Req() req
  ) {
    const loggedInUser = req.user as LoggedInUserType;
    return this.clientsService.update(id, dto, loggedInUser.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id", ParseIntPipe) id: number, @Req() req) {
    const loggedInUser = req.user as LoggedInUserType;
    return this.clientsService.remove(id, loggedInUser.id);
  }
}
