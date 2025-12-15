import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, OrderStatus } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateOrderDto, UpdateOrderDto } from "./order.dto";
import { startOfMonth, subMonths } from "date-fns";
import { LoggedInUserType } from "./orders.controller";
import { NotificationService } from "../notification/notification.service";

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService
  ) {}
  async getMonthlySales(companyId: number) {
    // تاريخ أول يوم من الشهر الحالي ناقص 11 شهر (يعني آخر 12 شهر)
    const startDate = startOfMonth(subMonths(new Date(), 11));

    const result = await this.prisma.order.groupBy({
      by: ["createdAt"],
      where: {
        companyId,
        createdAt: {
          gte: startDate,
        },
        deleted: false,
      },
      _sum: {
        total: true, // إجمالي المدفوع
        shipping: true,
      },
    });

    // ⚠️ groupBy بيرجعك createdAt كامل (بالثواني)، فلازم نعمل map لتجميعه حسب الشهر
    const monthly = result.reduce(
      (acc, order) => {
        const monthKey = `${order.createdAt.getFullYear()}-${order.createdAt.getMonth() + 1}`;

        if (!acc[monthKey]) {
          acc[monthKey] = { total: 0, shipping: 0 };
        }
        acc[monthKey].total += order._sum.total || 0;
        acc[monthKey].shipping += order._sum.shipping || 0;

        return acc;
      },
      {} as Record<string, { total: number; shipping: number }>
    );

    return monthly;
  }

  async createMany(
    dtos: CreateOrderDto[],
    companyId: number,
    loggedInUser: LoggedInUserType
  ) {
    // Create multiple orders
    let company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { deliveryPrecent: true },
    });

    const client = await this.prisma.client.findUnique({
      where: {
        id: +dtos[0].clientId,
      },
      select: {
        name: true,
      },
    });

    if (loggedInUser.role === "DELIVERY") {
      const user = await this.prisma.user.findUnique({
        where: {
          id: loggedInUser.id,
        },
        select: {
          delivery: {
            select: {
              company: {
                select: {
                  id: true,
                  deliveryPrecent: true,
                },
              },
            },
          },
        },
      });
      companyId = user.delivery.company.id;
      company = user.delivery.company;
    }

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const orders = await this.prisma.$transaction(
      dtos.map((dto) =>
        this.prisma.order.create({
          data: {
            ...dto,
            companyId,
            deliveryFee: dto.shipping
              ? (dto.shipping * company.deliveryPrecent) / 100
              : 0,
          },
        })
      )
    );

    // Create timeline records for all orders
    await this.prisma.$transaction(
      orders.map((order) =>
        this.prisma.orderTimeline.create({
          data: {
            orderId: order.id,
            status: order.status,
            note: "Order created",
          },
        })
      )
    );
    if (loggedInUser.role !== "DELIVERY") {
      const deliveries = await this.prisma.delivery.findMany({
        where: {
          companyId,
          online: true,
          id: orders[0].deliveryId ? orders[0].deliveryId : undefined,
        },
        select: {
          user: {
            select: {
              id: true,
            },
          },
        },
      });
      deliveries.forEach(async (delivery) => {
        await this.notificationService.sendNotification({
          title: "طلب جديد",
          content: ` هناك طلب جديد من العميل ${client.name} `,
          userId: delivery.user.id,
        });
      });
    }
    return orders;
  }

  async findAll(
    filters: {
      status?: OrderStatus;
      deliveryId?: number;
      clientId?: number;
      companyId?: number;
      from?: string;
      to?: string;
      search?: string;
      proccessed?: string;
      notComplete?: string;
    },
    page = 1,
    size = 10
  ) {
    const {
      status,
      deliveryId,
      clientId,
      companyId,
      from,
      to,
      search,
      proccessed,
      notComplete,
    } = filters;

    const where: Prisma.OrderWhereInput = {
      AND: [
        { deleted: false },
        {
          ...(notComplete
            ? {
                status: { in: ["ACCEPTED", "RECEIVED", "POSTPOND", "STARTED"] },
              }
            : status
              ? { status }
              : {}),
        },
        { ...(proccessed ? { processed: false } : {}) },
        {
          ...(deliveryId === -1
            ? { deliveryId: null }
            : deliveryId
              ? { deliveryId }
              : {}),
        },
        { ...(clientId ? { clientId } : {}) },
        { ...(companyId ? { companyId } : {}) },
        {
          ...(from && to
            ? {
                createdAt: {
                  gte: new Date(from),
                  lte: to ? new Date(to) : new Date(),
                },
              }
            : {}),
        },
        {
          ...(search
            ? {
                OR: [
                  { notes: { contains: search, mode: "insensitive" } },
                  { to: { contains: search, mode: "insensitive" } },
                  { id: isNaN(Number(search)) ? undefined : Number(search) },
                ],
              }
            : {}),
        },
      ],
    };

    const skip = (page - 1) * size;

    const notReciveedCount = await this.prisma.order.count({
      where: {
        status: { in: ["ACCEPTED"] },
        ...(deliveryId ? { deliveryId } : {}),
        ...(companyId ? { companyId } : {}),
        deleted: false,
      },
    });

    const totalnPaid = await this.prisma.order.aggregate({
      _count: { id: true },
      _sum: { total: true, shipping: true, deliveryFee: true },
      where: { ...where, processed: false, status: "DELIVERED" },
    });

    const totalPaid = await this.prisma.order.aggregate({
      _count: { id: true },
      _sum: { total: true, shipping: true, deliveryFee: true },
      where: where,
    });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip,
        take: size,
        select: {
          id: true,
          total: true,
          shipping: true,
          deliveryFee: true,
          notes: true,
          from: true,
          to: true,
          status: true,
          createdAt: true,
          processed: true,
          companyConfirm: true,
          deliveryConfirm: true,
          timeline: {
            select: {
              id: true,
              status: true,
              createdAt: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          delivery: {
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
        orderBy: { id: "desc" },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      notReciveedCount: notReciveedCount,
      notPaid: {
        count: totalnPaid._count.id || 0,
        total: totalnPaid._sum.total || 0,
        shipping: totalnPaid._sum.shipping || 0,
        deliveryFee: totalnPaid._sum.deliveryFee || 0,
      },
      totalPaid: {
        total: totalPaid._sum.total || 0,
        shipping: totalPaid._sum.shipping || 0,
        deliveryFee: totalPaid._sum.deliveryFee || 0,
      },
      pagination: {
        page,
        size,
        count: total,
        totalPages: Math.ceil(total / size),
      },
    };
  }

  async findAllByClient(
    filters: {
      status?: OrderStatus;
      deliveryId?: number;
      clientId?: number;
      companyId?: number;
      from?: string;
      to?: string;
      search?: string;
      proccessed?: string;
      notComplete?: string;
    },
    loggedInUser: LoggedInUserType
  ) {
    let { status, deliveryId, companyId, proccessed, notComplete } = filters;

    const delivery = await this.prisma.delivery.findUnique({
      where: {
        id: loggedInUser.id,
      },
      select: {
        companyId: true,
      },
    });

    if (loggedInUser.role === "DELIVERY") {
      companyId = delivery.companyId;
    }

    const where: Prisma.OrderWhereInput = {
      deleted: false,
      ...(notComplete
        ? { status: { in: ["ACCEPTED", "RECEIVED", "POSTPOND"] } }
        : status
          ? { status }
          : {}),
      ...(proccessed ? { processed: false } : {}),
      ...(deliveryId === -1
        ? { deliveryId: null }
        : deliveryId
          ? { deliveryId }
          : {}),
      ...(companyId ? { companyId } : {}),
    };

    // 1️⃣ Group by clientId
    const groups = await this.prisma.order.groupBy({
      by: ["clientId"],
      where,
      _count: { id: true },
    });

    // 2️⃣ Remove null clientIds → fixes Prisma error
    const clientIds = groups
      .map((g) => g.clientId)
      .filter((id): id is number => id !== null);

    // 3️⃣ Fetch only valid clients
    const clients = await this.prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, phone: true, address: true },
    });

    // 4️⃣ Merge client info with count
    let result = groups
      .filter((g) => g.clientId !== null)
      .map((g) => ({
        clientId: g.clientId!,
        ordersCount: g._count.id,
        ...clients.find((c) => c.id === g.clientId),
      }));

    // 5️⃣ Sort by most orders
    result.sort((a, b) => b.ordersCount - a.ordersCount);

    return { data: result };
  }

  async getAllForExport(filters: {
    status?: OrderStatus;
    deliveryId?: number;
    clientId?: number;
    companyId?: number;
    from?: string;
    to?: string;
    search?: string;
  }) {
    const { status, deliveryId, clientId, companyId, from, to, search } =
      filters;

    const where: Prisma.OrderWhereInput = {
      deleted: false,
      ...(status ? { status } : {}),
      ...(deliveryId ? { deliveryId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(companyId ? { companyId } : {}),
      ...(from && to
        ? {
            createdAt: {
              gte: new Date(from),
              lte: new Date(to),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { notes: { contains: search, mode: "insensitive" } },
              { to: { contains: search, mode: "insensitive" } },
              { id: isNaN(Number(search)) ? undefined : Number(search) },
            ],
          }
        : {}),
    };

    return this.prisma.order.findMany({
      where,
      orderBy: { id: "desc" },
      select: {
        id: true,
        total: true,
        shipping: true,
        notes: true,
        from: true,
        to: true,
        status: true,
        createdAt: true,
        client: {
          select: { name: true, phone: true },
        },
        delivery: {
          select: {
            user: { select: { name: true } },
          },
        },
      },
    });
  }

  async getAllDeliveriesWithLastOrders(
    filters: {
      companyId?: number;
    },
    page = 1,
    size = 10
  ) {
    const [results, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: "DELIVERY",
          delivery: filters.companyId
            ? {
                companyId: filters.companyId,
              }
            : undefined,
          deleted: false,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          avatar: true,
          delivery: {
            select: {
              online: true,
              orders: {
                select: {
                  id: true,
                  total: true,
                  shipping: true,
                  deliveryFee: true,
                  notes: true,
                  from: true,
                  to: true,
                  status: true,
                  createdAt: true,
                  company: {
                    select: {
                      deliveryPrecent: true,
                    },
                  },
                  timeline: {
                    select: {
                      id: true,
                      status: true,
                      createdAt: true,
                    },
                  },
                },
                where: {
                  deleted: false,
                  processed: false,
                },
                orderBy: {
                  id: "desc",
                },
              },
            },
          },
        },
        orderBy: [
          {
            delivery: {
              online: "desc",
            },
          },

          {
            delivery: {
              orders: {
                _count: "desc",
              },
            },
          },
        ],
        skip: (page - 1) * +size,
        take: +size,
      }),
      this.prisma.user.count({
        where: {
          role: "DELIVERY",
        },
      }),
    ]);

    return {
      pagination: {
        page,
        size,
        count: total,
        totalPages: Math.ceil(total / size),
      },
      data: results,
    };
  }

  async resetDeliveryCount(filters: {
    status?: OrderStatus;
    deliveryId?: number;
    clientId?: number;
    companyId?: number;
    from?: string;
    to?: string;
    search?: string;
  }) {
    const { status, deliveryId, companyId, from, to } = filters;

    const where: Prisma.OrderWhereInput = {
      deleted: false,
      ...(status ? { status } : {}),
      ...(deliveryId ? { deliveryId } : {}),
      ...(companyId ? { companyId } : {}),
      ...(from && to
        ? {
            createdAt: {
              gte: new Date(from),
              lte: to ? new Date(to) : new Date(),
            },
          }
        : {}),
    };

    const updated = await this.prisma.order.updateMany({
      where: { ...where, processed: false, status: "DELIVERED" },
      data: { processed: true },
    });

    return { message: `${updated.count} orders processed.` };
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        client: true,
        delivery: true,
        company: true,
        timeline: {
          orderBy: { createdAt: "asc" },
          include: { changedBy: true },
        },
      },
    });

    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async update(
    id: number,
    dto: UpdateOrderDto,
    loggedInUser: LoggedInUserType
  ) {
    const oldOrder = await this.prisma.order.findUnique({
      where: { id },
      include: { timeline: true, company: true },
    });

    if (!oldOrder) throw new NotFoundException("Order not found");

    console.log(oldOrder);

    if (
      dto.status === "DELIVERED" &&
      oldOrder.shipping === 0 &&
      !dto.shipping
    ) {
      throw new NotFoundException("يجب إضافه حساب الشركه اولا");
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        ...dto,
        deliveryFee: dto.shipping
          ? (dto.shipping * oldOrder.company.deliveryPrecent) / 100
          : 0,
      },
    });

    if (dto.shipping) {
      await this.prisma.order.update({
        where: { id },
        data: {
          deliveryFee: dto.shipping
            ? (dto.shipping * oldOrder.company.deliveryPrecent) / 100
            : 0,
        },
      });
    }

    if (dto.deliveryId && loggedInUser.role !== "DELIVERY") {
      const delivery = await this.prisma.delivery.findFirst({
        where: {
          id: +dto.deliveryId,
        },
        select: {
          user: {
            select: {
              id: true,
            },
          },
        },
      });
      await this.notificationService.sendNotification({
        title: "طلب جديد",
        content: `هناك طلب جديد مرسل إليك برقم ${oldOrder.id}`,
        userId: delivery.user.id,
      });
    }

    if (dto.status && dto.status !== oldOrder.status) {
      await this.prisma.orderTimeline.deleteMany({
        where: {
          orderId: id,
          status: dto.status,
        },
      });
      if (
        dto.status === "RECEIVED" &&
        !oldOrder.timeline.find((t) => t.status === "ACCEPTED")
      ) {
        await this.prisma.orderTimeline.create({
          data: {
            orderId: id,
            status: "ACCEPTED",
            changedById: loggedInUser.id,
            note: `Status changed from ${oldOrder.status} → ${dto.status}`,
          },
        });
      }
      if (
        dto.status === "DELIVERED" &&
        !oldOrder.timeline.find((t) => t.status === "ACCEPTED")
      ) {
        await this.prisma.orderTimeline.create({
          data: {
            orderId: id,
            status: "ACCEPTED",
            changedById: loggedInUser.id,
            note: `Status changed from ${oldOrder.status} → ${dto.status}`,
          },
        });
      }
      if (
        dto.status === "DELIVERED" &&
        !oldOrder.timeline.find((t) => t.status === "RECEIVED")
      ) {
        await this.prisma.orderTimeline.create({
          data: {
            orderId: id,
            status: "RECEIVED",
            changedById: loggedInUser.id,
            note: `Status changed from ${oldOrder.status} → ${dto.status}`,
          },
        });
      }
      await this.prisma.orderTimeline.create({
        data: {
          orderId: id,
          status: dto.status,
          changedById: loggedInUser.id,
          note: `Status changed from ${oldOrder.status} → ${dto.status}`,
        },
      });
    }

    return updated;
  }

  async remove(id: number) {
    const exists = await this.prisma.order.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Order not found");

    await this.prisma.order.update({
      where: { id },
      data: { deleted: true },
    });

    return { message: "Order deleted successfully" };
  }

  async removeMany(ids: number[]) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException("ids must be a non-empty array");
    }

    // Check invalid IDs
    const existingOrders = await this.prisma.order.findMany({
      where: { id: { in: ids } },
    });

    const existingIds = existingOrders.map((o) => o.id);

    // If some IDs don't exist
    const invalidIds = ids.filter((id) => !existingIds.includes(id));
    if (invalidIds.length > 0) {
      throw new NotFoundException(`Orders not found: ${invalidIds.join(", ")}`);
    }

    // Soft delete all
    await this.prisma.order.updateMany({
      where: { id: { in: ids } },
      data: { deleted: true },
    });

    return {
      message: "Orders deleted successfully",
      count: ids.length,
    };
  }

  async getOrderStatistics(vendorId?: number, deliveryId?: number) {
    const result = await this.prisma.order.aggregate({
      _count: { id: true },
      where: {
        companyId: vendorId ? +vendorId : undefined,
        deliveryId: deliveryId ? +deliveryId : undefined,
        deleted: false,
      },
    });

    const vendorCount = await this.prisma.user.aggregate({
      _count: { id: true },
      where: { role: "COMPANY_ADMIN", deleted: false },
    });

    const activeDeliveries = await this.prisma.delivery.aggregate({
      _count: { id: true },
      where: {
        companyId: vendorId ? +vendorId : undefined,
        user: { deleted: false },
      },
    });

    const totalPaid = await this.prisma.order.aggregate({
      _count: { id: true },
      _sum: { total: true, shipping: true },
      where: {
        companyId: vendorId ? +vendorId : undefined,
        deliveryId: deliveryId ? +deliveryId : undefined,
      },
    });

    const statuses = await this.prisma.order.groupBy({
      by: ["status"],
      _count: { status: true },
      where: {
        companyId: vendorId ? +vendorId : undefined,
        deliveryId: deliveryId ? +deliveryId : undefined,
        deleted: false,
      },
    });

    const statusCounts: Record<string, number> = Object.values(
      OrderStatus
    ).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<string, number>
    );

    statuses.forEach((s) => {
      statusCounts[s.status] = s._count.status;
    });

    const monthlySales = await this.getMonthlySales(vendorId);

    return {
      totalOrders: result._count?.id || 0,
      vendorCount: vendorCount._count?.id || 0,
      activeDeliveries: activeDeliveries._count?.id || 0,
      totalPaid: totalPaid._sum?.total || 0,
      shipping: totalPaid._sum?.shipping || 0,
      monthlySales,
      statusCounts,
    };
  }
}
