import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.room);
    client.emit('joinedRoom', `Joined room: ${data.room}`);
    client.to(data.room).emit('userJoined', `User ${client.id} joined room`);
  }

  emitOrderCreated(room: string, payload: any) {
    this.server.to(room).emit('newOrder', payload);
  }

  emitOrderUpdated(room: string, payload: any) {
    this.server.to(room).emit('updateOrder', payload);
  }
  emitOptionUpdated(room: string, payload: any) {
    this.server.to(room).emit('general', payload);
  }
  private server: Server;

  afterInit(server: Server) {
    this.server = server;
  }
}
