import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/common/prisma/prisma.service';

@WebSocketGateway(3001, {
  namespace : "stock",
  cors : { origin: '*' }
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly prisma: PrismaService) {}
  @WebSocketServer() server: Server
  private logger: Logger = new Logger("websocketGateway");
  afterInit(server: Server) {
    this.logger.log("Websocket server reset")
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client Connected : ${client.id}`);
  }
  
  handleDisconnect(client: Socket) {
    this.logger.log(`client Disconnected : ${client.id}`);
  }
  
  @SubscribeMessage("joinRoom")
  handleJoinRoom(@MessageBody() stockId: number, @ConnectedSocket() client: Socket) {
    const stockIdToString = stockId.toString();
    client.join(stockIdToString);
    this.stockUpdate(stockId);
  }

  public async stockUpdate(stockId: number) {
    const stockIdToString = stockId.toString();
    let data = {};

    const stockInfo = await this.prisma.stocks.findUnique({
      where : {
        id : stockId
      },
      select : {
        name : true,
        price : true
      }
    });
    const buyorderbookData = await this.prisma.$queryRaw
    `
      SELECT trading_type, price, SUM(number - match_number) AS number
      FROM \`order\` o
      WHERE stock_id = ${stockId} AND trading_type = "buy" AND status = "n" 
      GROUP BY trading_type, price
      ORDER BY price DESC
      LIMIT 10
    `
    const sellorderbookData = await this.prisma.$queryRaw
    `
      SELECT trading_type, price, SUM(number - match_number) AS number
      FROM \`order\` o
      WHERE stock_id = ${stockId} AND trading_type = "sell" AND status = "n" 
      GROUP BY trading_type, price
      ORDER BY price ASC
      LIMIT 10
    `
    const match = await this.prisma.$queryRaw
    `
      select (select price from \`order\` o where o.id = om.initial_order_id) as price, number, (select trading_type from \`order\` o where o.id = om.order_id) as type
      from order_match om where stock_id = ${stockId}
      order by matched_at desc limit 20;
    `
    data = {
      stockInfo : stockInfo,
      buyorderbookData : buyorderbookData,
      sellorderbookData : sellorderbookData,
      match : match
    }

    this.server.to(stockIdToString).emit('stockUpdated', data);
  }
}
