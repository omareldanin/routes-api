// socket.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: {
    origin: "*",
    credentials: true,
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log("Client connected:", client.id);
  }

  handleDisconnect(client: Socket) {
    console.log("Client disconnected:", client.id);
  }

  // User joins company room
  @SubscribeMessage("joinCompany")
  handleJoinCompany(client: Socket, companyId: number) {
    const room = `company-${companyId}`;
    client.join(room);
    console.log(`Client ${client.id} joined ${room}`);
  }

  // Emit new order to company
  notifyNewOrder(companyId: number, order: any) {
    this.server.to(`company-${companyId}`).emit("newOrder", order);
  }
}
