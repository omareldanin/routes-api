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
    const user = await this.prisma.user.findUnique({
      where: { id: +data.userId },
      select: { id: true, fcm: true },
    });

    if (user && user.fcm) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: user.fcm,
          sound: "new-order.wav",
          title: data.title,
          body: data.content,
        }),
      });
      console.log("response", response);
    }

    // save notifications في DB حتى لو حصل errors
    const results = await this.prisma.notification.create({
      data: {
        title: data.title,
        content: data.content,
        userId: user.id,
      },
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
    unSeenCount: number;
    page: number;
    totalPages: number;
    results: Notification[];
  }> {
    const page = +data.page || 1;
    const pageSize = +data.size || 10;

    const [results, total, unseen] = await Promise.all([
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
      this.prisma.notification.count({
        where: {
          userId: data.userId,
          seen: false,
        },
      }),
    ]);

    return {
      count: total,
      unSeenCount: unseen,
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
