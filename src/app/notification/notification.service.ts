import { Injectable } from "@nestjs/common";
import { Notification, NotificationTopic, UserRole } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import admin from "firebase-admin";
import { env } from "src/config";

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
  }),
});

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async sendNotification(data: {
    title: string;
    content: string;
    topic?: NotificationTopic | undefined;
    userId?: number | undefined;
  }) {
    let tokens: string[] = [];
    let ids: number[] = [];

    if (data.topic === "ALL") {
      const users = await this.prisma.user.findMany({
        where: { deleted: false, fcm: { not: null } },
        select: { id: true, fcm: true },
      });
      tokens = users.map((u) => u.fcm);
      ids = users.map((u) => u.id);
    } else if (data.topic) {
      const users = await this.prisma.user.findMany({
        where: { deleted: false, fcm: { not: null }, role: data.topic },
        select: { id: true, fcm: true },
      });
      tokens = users.map((u) => u.fcm);
      ids = users.map((u) => u.id);
    } else if (data.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: +data.userId },
        select: { id: true, fcm: true },
      });
      if (user) {
        ids = [user.id];
        tokens = [user.fcm || ""];
      }
    }

    if (tokens.length > 0) {
      const response = await admin.messaging().sendEachForMulticast({
        notification: { title: data.title, body: data.content },
        tokens,
      });

      // log كل النتائج
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          console.warn(
            `❌ Failed to send notification to token ${tokens[idx]}:`,
            res.error?.message
          );
        }
      });
    }

    // save notifications في DB حتى لو حصل errors
    const results = await this.prisma.notification.createMany({
      data: ids.map((id) => ({
        title: data.title,
        content: data.content,
        userId: id,
      })),
    });

    return { message: "success", results };
  }

  async getUserNotifications(data: {
    page: number;
    size: number;
    userId: number;
    role: UserRole;
  }): Promise<{
    count: number;
    page: number;
    totalPages: number;
    results: Notification[];
  }> {
    const page = +data.page || 1;
    const pageSize = +data.size || 10;

    const [results, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          userId: data.userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * +pageSize,
        take: +pageSize,
      }),
      this.prisma.notification.count({
        where: {
          userId: data.userId,
        },
      }),
    ]);

    return {
      count: total,
      page,
      totalPages: Math.ceil(total / pageSize),
      results: results,
    };
  }
  async updateNotificationSeen(data: { id: number }): Promise<Notification> {
    return await this.prisma.notification.update({
      where: {
        id: data.id,
      },
      data: {
        seen: true,
      },
    });
  }
  async updateUserNotificationsSeen(data: {
    userId: number;
  }): Promise<{ message: string }> {
    await this.prisma.notification.updateMany({
      where: {
        userId: data.userId,
        seen: false,
      },
      data: {
        seen: true,
      },
    });
    return { message: "success" };
  }
}
