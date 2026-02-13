import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { NotificationModule } from "../notification/notification.module";
import { SocketModule } from "src/socket/socket.module";

@Module({
  imports: [NotificationModule, SocketModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
