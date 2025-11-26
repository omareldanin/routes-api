import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateClientDto, UpdateClientDto } from "./client.dto";

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateClientDto, companyAdminId: number) {
    const exists = await this.prisma.client.findFirst({
      where: {
        phone: dto.phone,
      },
    });
    if (exists)
      throw new BadRequestException(
        "Client with this phone or code already exists"
      );

    const company = await this.prisma.company.findUnique({
      where: { id: companyAdminId },
    });
    if (!company)
      throw new BadRequestException("Company not found for this admin");

    return this.prisma.client.create({
      data: {
        phone: dto.phone,
        name: dto.name,
        address: dto.address,
        companyId: company.id,
      },
    });
  }

  async findAll(
    filters: { code?: string; name?: string; phone?: string },
    companyAdminId: number,
    page = 1,
    size = 10
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

  async update(id: number, dto: UpdateClientDto, companyAdminId: number) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId: companyAdminId },
    });
    if (!client) throw new NotFoundException("Client not found");

    return this.prisma.client.update({
      where: { id },
      data: dto,
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
