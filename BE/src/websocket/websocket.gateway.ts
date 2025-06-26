import { Logger, UseGuards } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { WsGuard } from './ws.guard';
import { CustomSocket } from './interfaces/custom-socket.interface';

interface userInfo {
  userId: number;
  accountId: number;
}

const clientInfo = new Map<string, userInfo>(); // clientId : userInfo
const clientJoinStockRoom = new Map<string, number>(); // clientId : stockId

/**
 * 방 종류
 * 
 * stockId_? // 특정 종목에 대한 정보를 보내주는 방
 * accountId_? // 특정 계좌에 대한 정보를 보내주는 방
 * 
 */

@UseGuards(WsGuard)
@WebSocketGateway(3003, {
  namespace : "/stock",
  cors : { origin: '*' }
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer() server: Server
  private logger: Logger = new Logger("websocketGateway");


  afterInit(server: Server) {
    this.logger.log("Websocket server reset");
  }

  handleConnection(client: CustomSocket) {
    this.logger.log(`Client Connected : ${client.id}`);
  }
  
  handleDisconnect(client: CustomSocket) {
    this.logger.log(`client Disconnected : ${client.id}`);
    if (clientInfo.get(client.id)) {
      clientInfo.delete(client.id);
    }

    if (clientJoinStockRoom.get(client.id)) {
      clientJoinStockRoom.delete(client.id);
    }
  }
  
  
  @SubscribeMessage("joinStockRoom")
  handleJoinStockRoom(@MessageBody() stockId: number, @ConnectedSocket() client: CustomSocket) {
    const stockIdToString = stockId.toString();
    
    if (clientJoinStockRoom.get(client.id)) {
      client.leave("stockId_" + clientJoinStockRoom.get(client.id));
      clientJoinStockRoom.delete(client.id);
    }
    client.join("stockId_" + stockIdToString);
    this.stockUpdate(stockId);
  }

  @SubscribeMessage("joinAccountRoom")
  async handleJoinAccountRoom(@ConnectedSocket() client: CustomSocket, @MessageBody() accountNumber?: number) {
    const userId = client.user.userId;
    
    // 다른 계좌로 변경할때
    if (clientInfo.get(client.id)) {
      if (!accountNumber) {
        client.emit('errorCustom', { message: "인자 값이 누락되었습니다" });
        client.disconnect();
        return false;
      }
      else {
        const account = await this.prisma.accounts.findUnique({
          where : { account_number: accountNumber }
        });
    
        if (!account) {
          client.emit('errorCustom', { message: "존재하지 않는 계좌입니다" });
          client.disconnect();
          return false;
        }
  
        if (account.user_id == userId) {
          client.leave("accountId_" + clientInfo.get(client.id).accountId);
          client.join("accountId" + account.id);
          this.accountUpdate(account.id)
        }
        else {
          client.emit('errorCustom', { message: "접근 권한이 없습니다" });
          client.disconnect();
          return false;
        }
      }
    }
    else {
      // 최초 연결시 가장 처음 생성한 계좌를 기본계좌로 세팅
      const basicAccount = await this.prisma.accounts.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: "asc" }
      });

      if (!basicAccount) {
        client.emit("errorCustom", { message: "계좌 개설후 이용해주세요" })
      }
      else {
        clientInfo.set(client.id, { userId: userId, accountId: basicAccount.id });
        client.join("accountId_" + basicAccount.id);
        this.accountUpdate(basicAccount.id);
      }
    }
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
    let buyOrderbookData = await this.prisma.$queryRaw
    `
      SELECT trading_type, price, SUM(number - match_number) AS number
      FROM \`order\` o
      WHERE stock_id = ${stockId} AND trading_type = "buy" AND status = "n" 
      GROUP BY trading_type, price
      ORDER BY price DESC
      LIMIT 10
    `
    let sellOrderbookData = await this.prisma.$queryRaw
    `
      SELECT trading_type, price, SUM(number - match_number) AS number
      FROM \`order\` o
      WHERE stock_id = ${stockId} AND trading_type = "sell" AND status = "n" 
      GROUP BY trading_type, price
      ORDER BY price ASC
      LIMIT 10
    `
    let matchData: any = await this.prisma.$queryRaw
    `
      select (select price from \`order\` o where o.id = om.initial_order_id) as price, number, (select trading_type from \`order\` o where o.id = om.order_id) as type
      from order_match om where stock_id = ${stockId}
      order by matched_at desc limit 20;
    `

    for(let i = 0; i < matchData.length; i++) {
        matchData[i].number = matchData[i].number.toString();
    }

    data = {
      stockInfo : stockInfo,
      buyOrderbookData : buyOrderbookData,
      sellOrderbookData : sellOrderbookData,
      match : matchData
    }

    this.server.to("stockId_" + stockIdToString).emit("stockUpdated", data);
  }

  public async accountUpdate(accountId: number) {
    const account = await this.prisma.user_stocks.findMany({
      where: { account_id: accountId },
      select: {
        stock_id: true,
        number: true,
        can_number: true,
        average: true,
        total_buy_amount: true,
        stocks: {
          select: {
            name: true,
          },
        },
      },
    });
    
    let data;
    let dataArray = [];
    
    for(let i = 0; i < account.length; i++) {
      const price = await this.prisma.stocks.findUnique({
        where: { id: account[i].stock_id },
        select: { price: true }
      });
      data = {
        name: account[i].stocks.name,
        nowPrice: price.price,
        amount: account[i].number.toString(),
        canAmount: account[i].can_number.toString(),
        average: account[i].average,
        totalBuyAmount: account[i].total_buy_amount.toString()
      }
      dataArray.push(data);
    } 
    
    this.server.to("accountId_" + accountId).emit("accountUpdated", dataArray)
  }

  public async orderStatus(accountId: number) {
    let returnData = {
      executionOrder: [],
      noExecutionOrder: []
    };

    let executionOrder = await this.prisma.order.findMany({
      where: { account_id: accountId },
      orderBy: { created_at: "asc" },
      include: {
        stocks: { 
          select: {
            name: true
          }
        }
      },
      take: 10
    });
    
    let noExecutionOrder = await this.prisma.order.findMany({
      where: { account_id: accountId },
      orderBy: { created_at: "asc" },
      include: {
        stocks: { 
          select: {
            name: true
          }
        }
      },
      take: 10
    });
    
    for(let i = 0; i < executionOrder.length; i++) {
      let data = {
        id: executionOrder[i].id,
        stockName: executionOrder[i].stocks.name,
        stockId: executionOrder[i].stock_id,
        price: executionOrder[i].price,
        number: executionOrder[i].number.toString(),
        matchNumber: executionOrder[i].match_number.toString(),
        status: executionOrder[i].status,
        tradingType: executionOrder[i].trading_type
      };

      returnData.executionOrder.push(data);
    }

    for(let i = 0; i < noExecutionOrder.length; i++) {
      let data = {
        id: noExecutionOrder[i].id,
        stockName: noExecutionOrder[i].stocks.name,
        stockId: noExecutionOrder[i].stock_id,
        price: noExecutionOrder[i].price,
        number: noExecutionOrder[i].number.toString(),
        matchNumber: noExecutionOrder[i].match_number.toString(),
        status: noExecutionOrder[i].status,
        tradingType: noExecutionOrder[i].trading_type
      };

      returnData.noExecutionOrder.push(data);
    }

    this.server.to("accountId_" + accountId).emit("myOrderUpdated", returnData)
  }
}

