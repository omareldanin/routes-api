import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./app/auth/auth.module";
import { UsersModule } from "./app/users/users.module";
import { NotificationModule } from "./app/notification/notification.module";

import { ChatGateway } from "./order.gateway";

import { ClientsModule } from "./app/clients/clients.module";
import { OrdersModule } from "./app/orders/orders.module";
import { SocketGateway } from './socket/socket.gateway';
import { SocketModule } from './socket/socket.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "uploads"),
      serveRoot: "/uploads", // URL prefix
    }),
    AuthModule,
    UsersModule,
    NotificationModule,
    ClientsModule,
    OrdersModule,
    SocketModule,
  ],
  controllers: [AppController],
  providers: [AppService, ChatGateway, SocketGateway],
})
export class AppModule {}
