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
  Res,
  UseGuards,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";

import { UserRole, OrderStatus } from "@prisma/client";
import { JwtAuthGuard } from "src/middlewares/jwt-auth.guard";
import { CreateOrderDto, UpdateOrderDto } from "./order.dto";
import * as ExcelJS from "exceljs";
import { Response } from "express";

export interface LoggedInUserType {
  id: number;
  name: string | undefined;
  phone: string;
  role: UserRole;
  superAdmin: boolean;
  iat: number;
  exp: number;
}
const orderStatusArabic: Record<string, string> = {
  STARTED: "جديد",
  ACCEPTED: "تم القبول",
  RECEIVED: "تم الاستلام",
  DELIVERED: "تم التوصيل",
  CANCELED: "ملغي",
  POSTPOND: "معلق",
};

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ✅ Create
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateOrderDto | CreateOrderDto[], @Req() req) {
    const loggedInUser = req.user as LoggedInUserType;
    const companyId = loggedInUser.id;

    // Handle both single and multiple orders
    if (Array.isArray(dto)) {
      return this.ordersService.createMany(dto, companyId);
    } else {
      return this.ordersService.createMany([dto], companyId);
    }
  }

  // ✅ Get all (pagination + filters)
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Req() req,
    @Query("status") status?: OrderStatus,
    @Query("deliveryId") deliveryId?: string,
    @Query("clientId") clientId?: string,
    @Query("companyId") companyId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("search") search?: string,
    @Query("proccessed") proccessed?: string,
    @Query("page") page = "1",
    @Query("size") size = "10"
  ) {
    const loggedInUser = req.user as LoggedInUserType;

    if (loggedInUser.role === "COMPANY_ADMIN") {
      companyId = loggedInUser.id + "";
    }

    if (loggedInUser.role === "DELIVERY") {
      deliveryId = loggedInUser.id + "";
    }

    return this.ordersService.findAll(
      {
        status,
        deliveryId: deliveryId ? Number(deliveryId) : undefined,
        clientId: clientId ? Number(clientId) : undefined,
        companyId: companyId ? Number(companyId) : undefined,
        proccessed,
        from,
        to,
        search,
      },
      parseInt(page),
      parseInt(size)
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("/reset-delivery-count")
  async resetDeliveryCount(
    @Req() req,
    @Query("status") status?: OrderStatus,
    @Query("deliveryId") deliveryId?: string,
    @Query("clientId") clientId?: string,
    @Query("companyId") companyId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("search") search?: string
  ) {
    const loggedInUser = req.user as LoggedInUserType;

    if (loggedInUser.role === "COMPANY_ADMIN") {
      companyId = loggedInUser.id + "";
    }
    return this.ordersService.resetDeliveryCount({
      status,
      deliveryId: deliveryId ? Number(deliveryId) : undefined,
      clientId: clientId ? Number(clientId) : undefined,
      companyId: companyId ? Number(companyId) : undefined,
      from,
      to,
      search,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get("export")
  async exportExcel(
    @Req() req,
    @Res() res: Response,
    @Query("status") status?: OrderStatus,
    @Query("deliveryId") deliveryId?: string,
    @Query("clientId") clientId?: string,
    @Query("companyId") companyId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("search") search?: string
  ) {
    const loggedInUser = req.user;

    if (loggedInUser.role === "COMPANY_ADMIN") {
      companyId = loggedInUser.id + "";
    }

    // Get all data (no pagination)
    const data = await this.ordersService.getAllForExport({
      status,
      deliveryId: deliveryId ? Number(deliveryId) : undefined,
      clientId: clientId ? Number(clientId) : undefined,
      companyId: companyId ? Number(companyId) : undefined,
      from,
      to,
      search,
    });

    // --- Create Excel File ---
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Orders");

    // Header row
    sheet.addRow([
      "رقم الطلب",
      "قيمة الطلب",
      "الشحن",
      "من",
      "الى",
      "الحالة",
      "اسم العميل",
      "رقم العميل",
      "الطيار",
      "تاريخ الانشاء",
    ]);

    // Data rows
    data.forEach((order) => {
      sheet.addRow([
        order.id,
        order.total,
        order.shipping,
        order.from,
        order.to,
        orderStatusArabic[order.status] ?? order.status,
        ,
        order.client?.name,
        order.client?.phone,
        order.delivery?.user?.name,
        new Date(order.createdAt).toLocaleString("ar-EG"),
      ]);
    });

    // Write file to response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=orders.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  }
  @UseGuards(JwtAuthGuard)
  @Get("/deliveries-with-last-orders")
  async getAllDeliveriesWithLastOrders(
    @Req() req,
    @Query("page") page = "1",
    @Query("size") size = "10"
  ) {
    const loggedInUser = req.user as LoggedInUserType;
    let companyId: string | undefined = undefined;

    if (loggedInUser.role === "COMPANY_ADMIN") {
      companyId = loggedInUser.id + "";
    }

    return this.ordersService.getAllDeliveriesWithLastOrders(
      {
        companyId: companyId ? Number(companyId) : undefined,
      },
      parseInt(page),
      parseInt(size)
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("/statistics")
  async getStatistics(
    @Req() req,
    @Query("vendorId") vendorId?: string,
    @Query("deliveryId") deliveryId?: string
  ) {
    const loggedInUser = req.user as LoggedInUserType;

    return this.ordersService.getOrderStatistics(
      loggedInUser.role === "COMPANY_ADMIN"
        ? loggedInUser.id
        : vendorId
          ? +vendorId
          : undefined,
      loggedInUser.role === "DELIVERY"
        ? loggedInUser.id
        : deliveryId
          ? +deliveryId
          : undefined
    );
  }

  // ✅ Get one
  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  // ✅ Update (status timeline tracked)
  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateOrderDto,
    @Req() req
  ) {
    const loggedInUser = req.user as LoggedInUserType;
    return this.ordersService.update(id, dto, loggedInUser.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("multi")
  async removeMany(@Body("ids") ids: number[]) {
    return this.ordersService.removeMany(ids);
  }

  // ✅ Delete
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.ordersService.remove(id);
  }
}
