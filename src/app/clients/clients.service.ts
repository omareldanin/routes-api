import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateClientDto, UpdateClientDto } from "./client.dto";
import { nanoid } from "nanoid";
import * as XLSX from "xlsx";

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateClientDto, companyAdminId: number) {
    const exists = await this.prisma.client.findFirst({
      where: { phone: dto.phone },
    });

    if (exists)
      throw new BadRequestException("Client with this phone already exists");

    const company = await this.prisma.company.findUnique({
      where: { id: companyAdminId },
    });

    if (!company)
      throw new BadRequestException("Company not found for this admin");

    const key = nanoid(10); // 🔹 short (10 chars)

    return this.prisma.client.create({
      data: {
        phone: dto.phone,
        name: dto.name,
        address: dto.address,
        companyId: company.id,
        shippingValue: dto.shippingValue || 0,
        activeShipping: dto.activeShipping === "true" ? true : false,
        key,
      },
    });
  }

  async createFromExcel(file: Express.Multer.File, companyAdminId: number) {
    if (!file) {
      throw new BadRequestException("Excel file is required");
    }

    // 1️⃣ Validate company
    const company = await this.prisma.company.findUnique({
      where: { id: companyAdminId },
    });

    if (!company) {
      throw new BadRequestException("Company not found");
    }

    // 2️⃣ Read Excel buffer
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      throw new BadRequestException("Excel sheet is empty");
    }

    // 3️⃣ Get all phones from sheet
    // const phones = rows.map((r) => String(r.phone));

    // // 4️⃣ Check existing clients
    // const existingClients = await this.prisma.client.findMany({
    //   where: {
    //     phone: { in: phones },
    //   },
    //   select: { phone: true },
    // });

    // const existingPhones = new Set(existingClients.map((c) => c.phone));

    // 5️⃣ Prepare new clients only
    const newClients = rows.map((r) => ({
      name: r.name,
      phone: String(r.phone).startsWith("0") ? r.phone : "0" + r.phone,
      address: r.address || "",
      shippingValue: 0,
      activeShipping: false,
      companyId: company.id,
      key: nanoid(10),
    }));

    if (!newClients.length) {
      throw new BadRequestException("All clients already exist");
    }

    // 6️⃣ Bulk insert
    const result = await this.prisma.client.createMany({
      data: newClients,
      skipDuplicates: true,
    });

    return {
      created: result.count,
      skipped: rows.length - result.count,
    };
  }
  async findAll(
    filters: { code?: string; name?: string; phone?: string },
    companyAdminId: number,
    page = 1,
    size = 10,
  ) {
    const { code, name, phone } = filters;

    const where: Prisma.ClientWhereInput = {
      companyId: companyAdminId,
      ...(code ? { code: { contains: code, mode: "insensitive" } } : {}),
      ...(name ? { name: { contains: name, mode: "insensitive" } } : {}),
      ...(phone ? { phone: { contains: phone, mode: "insensitive" } } : {}),
    };

    const skip = (+page - 1) * +size;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: +size,
      }),
      this.prisma.client.count({ where }),
    ]);

    const clientIds = data.map((c) => c.id);
    if (clientIds.length === 0) {
      return { data: [], pagination: { page, size, count: 0, totalPages: 0 } };
    }

    const orderStats = await this.prisma.order.groupBy({
      by: ["clientId"],
      where: {
        clientId: { in: clientIds },
        deleted: false,
      },
      _count: { id: true },
      _sum: { total: true, shipping: true },
    });

    // ✅ Combine client info + order stats
    const enriched = data.map((client) => {
      const stats = orderStats.find((s) => s.clientId === client.id);
      return {
        ...client,
        ordersCount: stats?._count?.id || 0,
        totalShipping: stats?._sum?.shipping || 0,
        totalAmount: stats?._sum?.total || 0,
      };
    });
    return {
      data: enriched,
      pagination: {
        page,
        size,
        count: total,
        totalPages: Math.ceil(total / size),
      },
    };
  }

  async findOne(id: number, companyAdminId: number) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId: companyAdminId },
    });
    if (!client) throw new NotFoundException("Client not found");
    return client;
  }

  async findOneByKey(key: string) {
    const client = await this.prisma.client.findFirst({
      where: { key },
      select: {
        id: true,
        key: true,
        address: true,
        name: true,
        company: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    if (!client) throw new NotFoundException("Client not found");
    return client;
  }

  async update(id: number, dto: UpdateClientDto, companyAdminId: number) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId: companyAdminId },
    });
    if (!client) throw new NotFoundException("Client not found");

    return this.prisma.client.update({
      where: { id },
      data: {
        ...dto,
        activeShipping: dto.activeShipping === "true" ? true : false,
      },
    });
  }

  async remove(id: number, companyAdminId: number) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId: companyAdminId },
    });
    if (!client) throw new NotFoundException("Client not found");

    await this.prisma.client.delete({ where: { id } });
    return { message: "Client deleted successfully" };
  }
}
