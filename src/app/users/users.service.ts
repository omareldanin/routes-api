import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma, User, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { env } from "src/config";
import { PrismaService } from "src/prisma/prisma.service";
import { userSelect, userSelectReform } from "./user.response";
import { CreateUserDto, UpdateUserDto } from "./user.dto";
import { addDays } from "date-fns";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existing) throw new BadRequestException("رقم الهاتف موجود مسبقا");

    const hashedPassword = await bcrypt.hash(
      dto.password + env.PASSWORD_SALT,
      12,
    );

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        password: hashedPassword,
        name: dto.name,
        avatar: dto.avatar,
        role: dto.role,
      },
    });

    // Create role-specific relation
    if (dto.role === "COMPANY_ADMIN") {
      const startDate = dto.supscriptionStartDate
        ? new Date(dto.supscriptionStartDate)
        : new Date();
      const endDate = dto.supscriptionEndDate
        ? new Date(dto.supscriptionEndDate)
        : addDays(startDate, 30);

      await this.prisma.company.create({
        data: {
          address: dto.address,
          latitude: dto.latitude,
          longitudes: dto.longitudes,
          supscriptionStartDate: startDate,
          supscriptionEndDate: endDate,
          user: { connect: { id: user.id } },
        },
      });
    } else if (dto.role === "DELIVERY") {
      await this.prisma.delivery.create({
        data: {
          code: user.id + "",
          worksFroms: dto.worksFroms ?? "9am",
          worksTo: dto.worksTo ?? "5pm",
          user: { connect: { id: user.id } },
          company: { connect: { id: dto.companyId } },
        },
      });
    } else if (dto.role === "ADMIN") {
      await this.prisma.admin.create({
        data: {
          permissions: dto.permissions,
          user: { connect: { id: user.id } },
        },
      });
    }

    return user;
  }

  async findOne(params: {
    phone?: string | undefined;
    id?: number | undefined;
  }): Promise<
    | Prisma.UserGetPayload<{
        select: typeof userSelect;
      }>
    | undefined
  > {
    return await this.prisma.user.findFirst({
      where: params.id
        ? {
            id: params.id,
            deleted: false,
            // active: true,
          }
        : {
            phone: params.phone,
            deleted: false,
            // active: true,
          },
      select: userSelect,
    });
  }

  async findOneById(params: { id?: number | undefined }): Promise<
    | Prisma.UserGetPayload<{
        select: typeof userSelect;
      }>
    | undefined
  > {
    return await this.prisma.user.findUnique({
      where: {
        id: params.id,
        deleted: false,
      },
      select: userSelect,
    });
  }

  async getProfile(id: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: +id,
      },
      select: userSelect,
    });

    return { user: userSelectReform(user) };
  }

  async getAllUser(filters: {
    role: UserRole;
    page: number;
    size: number;
    phone?: string;
    comanyId?: number;
    name?: string;
  }) {
    const page = +filters.page || 1;
    const pageSize = +filters.size || 10;

    const [results, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: filters.role,
          name: filters.name ? { contains: filters.name } : undefined,
          phone: filters.phone ? { contains: filters.phone } : undefined,
          delivery: filters.comanyId
            ? {
                companyId: filters.comanyId,
              }
            : undefined,
          deleted: false,
        },
        select: userSelect,
        orderBy: {
          id: "asc",
        },
        skip: (page - 1) * +pageSize,
        take: +pageSize,
      }),
      this.prisma.user.count({
        where: {
          role: filters.role,
        },
      }),
    ]);

    return {
      count: total,
      page,
      totalPages: Math.ceil(total / pageSize),
      results: results.map((user) => userSelectReform(user)),
    };
  }

  async deleteUser(id: number) {
    await this.prisma.user.delete({
      where: {
        id: +id,
      },
    });

    return { message: "success" };
  }

  async updateToken(data: {
    id: number;
    refreshToken?: string;
    refreshTokens?: string[];
    fcm: string | undefined;
  }): Promise<{ refresh_token: string[] }> {
    return await this.prisma.user.update({
      where: {
        id: +data.id,
      },
      data: {
        fcm: data.fcm ? data.fcm : undefined,
        // Only one session is allowed
        refresh_token: data.refreshToken
          ? { set: [data.refreshToken] }
          : data.refreshTokens
            ? { set: data.refreshTokens }
            : undefined,
      },
      select: {
        refresh_token: true,
      },
    });
  }

  async getUserByID(userID: number) {
    const returnedUser = await this.prisma.user.findUnique({
      where: {
        id: userID,
      },
      select: userSelect,
    });
    return returnedUser;
  }

  async getUserRefreshTokens(userID: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userID,
      },
      select: {
        refresh_token: true,
      },
    });
    return user?.refresh_token;
  }

  async updateProfile(id: number, data: UpdateUserDto): Promise<User> {
    if (data.phone) {
      const existing = await this.prisma.user.findUnique({
        where: { phone: data.phone },
      });
      if (existing && +existing.id !== id)
        throw new BadRequestException("رقم الهاتف موجود مسبقا");
    }

    const hashedPassword = await bcrypt.hash(
      data.password + env.PASSWORD_SALT,
      12,
    );

    if (data.supscriptionStartDate) {
      const startDate = data.supscriptionStartDate;
      const endDate = data.supscriptionEndDate
        ? new Date(data.supscriptionEndDate)
        : addDays(startDate, 30);

      await this.prisma.company.update({
        where: { id: id },
        data: {
          supscriptionStartDate: startDate,
          supscriptionEndDate: endDate,
        },
      });
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      select: {
        company: { select: { id: true } },
        delivery: { select: { id: true } },
      },
    });

    const companyUpdate = existingUser.company
      ? {
          company: {
            update: {
              address: data.address || undefined,
              latitude: data.latitude || undefined,
              longitudes: data.longitudes || undefined,
              min: data.min,
              max: data.max,
              deliveryPrecent: data.deliveryPrecent,
              confirmOrders: data.confirmOrders === "true" ? true : false,
            },
          },
        }
      : {};

    const deliveryUpdate = existingUser.delivery
      ? {
          delivery: {
            update: {
              worksFroms: data.worksFroms || undefined,
              worksTo: data.worksTo || undefined,
              latitude: data.latitude || undefined,
              longitudes: data.longitudes || undefined,
              online:
                data.online === "true"
                  ? true
                  : data.online === "false"
                    ? false
                    : undefined,
            },
          },
        }
      : {};

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        avatar: data.avatar,
        password: data.password ? hashedPassword : undefined,
        fcm: data.fcm,
        ...companyUpdate,
        ...deliveryUpdate,
      },
    });

    return user;
  }

  async renewSubscriptionForOne(companyId: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) throw new BadRequestException("Company not found");

    const now = new Date();
    const startDate =
      company.supscriptionEndDate && company.supscriptionEndDate > now
        ? company.supscriptionEndDate // extend from old expiry if still valid
        : now; // or start now if expired

    const newEndDate = addDays(startDate, 30);

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        supscriptionStartDate: startDate,
        supscriptionEndDate: newEndDate,
      },
    });

    return {
      message: `Subscription renewed until ${newEndDate.toISOString()}`,
      company: updated,
    };
  }

  async renewAllSubscriptions() {
    const companies = await this.prisma.company.findMany();

    if (companies.length === 0)
      throw new BadRequestException("No companies found");

    const now = new Date();

    const updates = await Promise.all(
      companies.map(async (company) => {
        const startDate =
          company.supscriptionEndDate && company.supscriptionEndDate > now
            ? company.supscriptionEndDate
            : now;

        const newEndDate = addDays(startDate, 30);

        return this.prisma.company.update({
          where: { id: company.id },
          data: {
            supscriptionStartDate: startDate,
            supscriptionEndDate: newEndDate,
          },
        });
      }),
    );

    return {
      message: `Renewed ${updates.length} company subscriptions.`,
      companies: updates,
    };
  }

  async updateUser(id: number, data: UpdateUserDto) {
    if (data.phone) {
      const existing = await this.prisma.user.findUnique({
        where: { phone: data.phone },
      });
      if (existing && +existing.id !== id)
        throw new BadRequestException("رقم الهاتف موجود مسبقا");
    }
    const user = await this.prisma.user.update({
      where: {
        id: id,
      },
      data: {
        name: data.name,
        phone: data.phone,
        avatar: data.avatar,
        fcm: data.fcm,
        password: data.password
          ? bcrypt.hashSync(data.password + (env.PASSWORD_SALT as string), 12)
          : undefined,
        company: {
          update: {
            data: {
              address: data.address || undefined,
              latitude: data.latitude || undefined,
              longitudes: data.longitudes || undefined,
            },
          },
        },
        delivery: {
          update: {
            data: {
              online:
                data.online === "true"
                  ? true
                  : data.online === "false"
                    ? false
                    : undefined,
            },
          },
        },
      },
    });

    return user;
  }

  async resetPassword(data: {
    id: number;
    password: string;
  }): Promise<{ token: string }> {
    return await this.prisma.user.update({
      where: {
        id: data.id,
      },
      data: {
        password: bcrypt.hashSync(
          data.password + (env.PASSWORD_SALT as string),
          12,
        ),
      },
      select: {
        token: true,
      },
    });
  }
}
