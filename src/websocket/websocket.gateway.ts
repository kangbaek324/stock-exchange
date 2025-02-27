import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/prisma/prisma.service';

// StockId 1로 하드코딩 되어있음
@WebSocketGateway(3001, {
  namespace : "stock",
  cors : { origin: '*' }
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly prisma: PrismaService) {}
  @WebSocketServer() server: Server
  private logger: Logger = new Logger("websocketGateway");
  // private clients = new Map<string, string>();

  afterInit(server: Server) {
    this.logger.log("웹소켓 서버 초기화")
  }
  
  async handleConnection(client: Socket) {
    this.logger.log(`Client Connected : ${client.id}`);
    this.stockUpdate();
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`client Disconnected : ${client.id}`);
    // this.clients.delete(client.id);
  }

  // @SubscribeMessage('joinStock')
  // handleJoinStock(client: any, stockId: string): void {
  //     console.log(`클라이언트가 주식에 가입함: ${stockId}`);
  //     this.clients.set(client.id, stockId); 
  //     client.join(stockId);
  // }

  public async stockUpdate() {
    let data = {};
    const stockInfo = await this.prisma.stocks.findUnique({
      where : {
        id : 1
      },
      select : {
        name : true,
        price : true
      }
    })
    const buyorderbookData = await this.prisma.$queryRaw
    `
      SELECT trading_type, price, SUM(number - match_number) AS number
      FROM \`order\` o
      WHERE stock_id = 1 AND trading_type = "buy" AND status = "n" 
      GROUP BY trading_type, price
      ORDER BY price DESC
      LIMIT 10
    `
    const sellorderbookData = await this.prisma.$queryRaw
    `
      SELECT trading_type, price, SUM(number - match_number) AS number
      FROM \`order\` o
      WHERE stock_id = 1 AND trading_type = "sell" AND status = "n" 
      GROUP BY trading_type, price
      ORDER BY price ASC
      LIMIT 10
    `
    const match = await this.prisma.$queryRaw
    `
      select (select price from \`order\` o where o.id = om.initial_order_id) as price, number, (select trading_type from \`order\` o where o.id = om.order_id) as type
      from order_match om where stock_id = 1 
      order by matched_at desc limit 20;
    `
    data = {
      stockInfo : stockInfo,
      buyorderbookData : buyorderbookData,
      sellorderbookData : sellorderbookData,
      match : match
    }

    this.server.emit('stockUpdated', data);
  }
}
