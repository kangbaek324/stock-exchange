import { BadRequestException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { BuyDto } from './dtos/buy.dto';
import { SellDto } from './dtos/sell.dto';
import { CancelDto } from './dtos/cancel.dto';
import { OrdersValidationService } from './orders-validation.service';
import { OrdersExecutionService } from './orders-execution.service';
import { GetOrderDto } from './dtos/get-order.dto';
import { WebsocketGateway } from 'src/websocket/websocket.gateway';
import { EditDto } from './dtos/edit.dto';
import { Order, PrismaClient, TradingType } from '@prisma/client';
import { ClientProxy } from '@nestjs/microservices';
import { orderToJson } from './utils/orders.util';

@Injectable()
export class OrdersService {
  constructor(
    @Inject('ORDER_SERVICE') private client: ClientProxy,
    private readonly prisma: PrismaService,
    private readonly ordersValidation: OrdersValidationService,
    private readonly ordersExecution: OrdersExecutionService,
    private readonly websocket: WebsocketGateway,
  ) {
  }

  async sendMQ(
    data: BuyDto | SellDto | CancelDto | EditDto,
    user,
    type: 'buy' | 'sell' | 'cancel' | 'edit',
  ) {
    const mqData = {
      data,
      type: type,
      user,
      timestamp: Number(process.hrtime.bigint()),
    };

    return this.client.send('order', mqData);
  }

  async sendOrder(mqData) {
    if (mqData.type === 'buy') {
      return await this.trade(mqData.data, 'buy');
    } else if (mqData.type === 'sell') {
      return await this.trade(mqData.data, 'sell');
    } else if (mqData.type === 'cancel') {
      return await this.cancel(mqData.data);
    } else if (mqData.type === 'edit') {
      return await this.edit(mqData.data);
    }
  }

  async getOrder(query: GetOrderDto, user) {
    const resultMessage = await this.ordersValidation.getOrderValidate(
      query,
      user,
    );
    if (resultMessage) {
      throw new BadRequestException(resultMessage);
    }
    try {
      const account = await this.prisma.account.findUnique({
        where: {
          accountNumber: query.accountnumber,
        },
        select: {
          id: true,
        },
      });

      const findConditions: any = {
        accountId: account.id,
      };

      if (query.status) {
        findConditions.status = query.status;
      }

      return await this.prisma.order.findMany({
        where: findConditions,
        include: {
          stocks: {
            select: {
              name: true,
            },
          },
        },
      });
    } catch (err) {
      console.error(err);
      throw new BadRequestException('서버에 오류가 발생했습니다');
    }
  }

  // @TODO Redis 롤백 구현 가능
  async trade(data: BuyDto | SellDto, tradingType: TradingType) {
    let result;
    let accountUpdateList;

    try {
     await this.prisma.$transaction(async (prisma: PrismaClient) => {
        // 계좌 ID 조회
        const account = await prisma.account.findUnique({
          where: { accountNumber: data.accountNumber },
          select: { id: true },
        });
        
        if (data.orderType == 'market') data.price = 0;

        // 주문 생성
        let submitOrder = await prisma.order.create({
          data: {
            accountId: account.id,
            stockId: data.stockId,
            price: data.price,
            number: data.number,
            orderType: data.orderType,
            tradingType: tradingType,
          },
        });
        
        // 체결 가능 주문 탐색
        accountUpdateList = await this.ordersExecution.processSubmitOrder(
          prisma,
          data,
          submitOrder,
        );
      });
    } catch(err) {
      console.error(err);
      throw new InternalServerErrorException('주문 처리중 오류가 발생했습니다');
    }

    try {
      // 주식 가격 전송
      await this.websocket.stockUpdate(data.stockId);

      // 계좌, 주문 현황 업데이트 사항 전송 (웹소켓)
      for (const accountId of accountUpdateList) {
        await this.websocket.accountUpdate(accountId);
        await this.websocket.orderStatus(accountId);
      }

      // 주식을 보유한 사람들의 잔고 업데이트
      const userStocks = await this.prisma.userStock.findMany({
        where: {
          stockId: data.stockId,
        },
      });
      
      for (let i = 0; i < userStocks.length; i++) {
        await this.websocket.accountUpdate(userStocks[i].accountId);
      }

    } catch (err) {
      console.error('웹소켓 전송오류' + err);
    }
  }

  /**
   * @TODO
   * 정정시 주문시 체결가능한 주식 탐색 로직 필요
   */
  async edit(data: EditDto) {
    let order: Order, redisKey, beforeOrder;

    try {
      // 기존 주문 조회
      order = await this.prisma.order.findUnique({
        where: { id: data.orderId },
      });

      redisKey =
        order.tradingType == 'buy'
          ? `orderbook:${order.stockId}:buy`
          : `orderbook:${order.stockId}:sell`;

      beforeOrder = orderToJson(order);

      // 주문 정정 (DB)
      order = await this.prisma.order.update({
        data: {
          price: data.price,
        },
        where: {
          id: data.orderId,
        },
      });
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('주문 처리중 오류가 발생했습니다');
    }

    // 웹소켓 전송
    try {
      await this.websocket.stockUpdate(order.stockId);
      await this.websocket.accountUpdate(order.accountId);
      await this.websocket.orderStatus(order.accountId);
    } catch (err) {
      console.error('웹소켓 전송오류' + err);
    }
  }

  async cancel(data: CancelDto) {
    let order: Order;

    // 취소 주문
    try {
      await this.prisma.$transaction(async () => {
        // 주문 조회
        order = await this.prisma.order.findFirst({
          where: { id: data.orderId },
        });

        // 주문 취소 (DB)
        order = await this.prisma.order.update({
          data: {
            status: 'c',
          },
          where: {
            id: data.orderId,
          },
        });

        // 매도 주문일 경우 가능수량 수정
        if (order.tradingType == 'sell') {
          const userStock = await this.prisma.userStock.findFirst({
            where: {
              stockId: order.stockId,
              accountId: order.accountId,
            },
          });

          await this.prisma.userStock.update({
            where: {
              accountId_stockId: {
                stockId: order.stockId,
                accountId: order.accountId
              }
            },
            data: {
              canNumber:
                userStock.canNumber + order.number - order.matchNumber,
            },
          });
        }
      });
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('주문 처리중 오류가 발생했습니다');
    }

    // 웹소켓 전송
    try {
      await this.websocket.stockUpdate(order.accountId);
      await this.websocket.accountUpdate(order.accountId);
      await this.websocket.orderStatus(order.accountId);
    } catch (err) {
      console.error('웹소켓 전송오류' + err);
    }
  }
}