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
import { PrismaClient } from '@prisma/client';
import { ClientProxy } from '@nestjs/microservices';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

// @TODO Redis가 죽었을때 상황을 처리해야함
@Injectable()
export class OrdersService {
  private readonly redis: Redis | null;
  constructor(
    @Inject('ORDER_SERVICE') private client: ClientProxy,
    private readonly prisma: PrismaService,
    private readonly ordersValidation: OrdersValidationService,
    private readonly ordersExecution: OrdersExecutionService,
    private readonly websocket: WebsocketGateway,
    private readonly redisService: RedisService,
  ) {
    this.redis = this.redisService.getOrThrow();
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

    return await this.client.send('order', mqData);
  }

  async sendOrder(mqData) {
    if (mqData.type === 'buy') {
      return await this.buy(mqData.data, mqData.user);
    } else if (mqData.type === 'sell') {
      return await this.sell(mqData.data, mqData.user);
    } else if (mqData.type === 'cancel') {
      return await this.cancel(mqData.data, mqData.user);
    } else if (mqData.type === 'edit') {
      return await this.edit(mqData.data, mqData.user);
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
      const account = await this.prisma.accounts.findUnique({
        where: {
          account_number: query.accountnumber,
        },
        select: {
          id: true,
        },
      });

      const findConditions: any = {
        account_id: account.id,
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

  async buy(data: BuyDto, user) {
    let result;
    let jsonOrder;

    // 매수 주문
    try {
      await this.prisma.$transaction(async (prisma: PrismaClient) => {
        const account = await prisma.accounts.findUnique({
          where: { account_number: data.accountNumber },
          select: { id: true }
        });

        if (data.orderType == 'market') data.price = 0;

        // 주문 생성
        let submitOrder = await prisma.order.create({
          data: {
            account_id: account.id,
            stock_id: data.stockId,
            price: data.price,
            number: data.number,
            order_type: data.orderType,
            trading_type: 'buy',
          },
        });

        // Redis 주문 저장
        const unixTime = Date.now(); // 밀리초 단위

        jsonOrder = JSON.stringify(submitOrder, (_, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        );

        const score = data.price * 1_000_000_000_000 + unixTime;
        await this.redis.zadd(
          `orderbook:${data.stockId}:buy`,
          score,
          jsonOrder,
        );

        // 체결 가능 주문 탐색
        result = await this.ordersExecution.order(
          prisma,
          data,
          submitOrder,
          score
        );

        // 처리된 주문 Redis에서 삭제
        for (const sellScore of result.sell) {
          await this.redis.zremrangebyscore(`orderbook:${data.stockId}:sell`, sellScore, sellScore);
        }
    
        for (const buyScore of result.buy) {
          await this.redis.zremrangebyscore(`orderbook:${data.stockId}:buy`, buyScore, buyScore);
        }
      });
    } catch (err) {
      await this.redis.zrem(`orderbook:${data.stockId}:buy`, jsonOrder);

      console.error(err);
      throw new InternalServerErrorException('주문 처리중 오류가 발생했습니다');
    }

    // 웹 소켓 전송
    try {
      // 주식 가격 전송
      await this.websocket.stockUpdate(data.stockId);

      // 주문 현황 업데이트 (미구현)

      // 주식을 보유한 사람들의 잔고 업데이트
      const userStocks = await this.prisma.user_stocks.findMany({
        where: {
          stock_id: data.stockId,
        },
      });
      for (let i = 0; i < userStocks.length; i++) {
        await this.websocket.accountUpdate(userStocks[i].account_id);
      }
    } catch (err) {
      console.error('웹소켓 전송오류' + err);
    }
  }

  async sell(data: SellDto, user) {
    let result;
    let jsonOrder;

    // 매도 주문
    try {
      await this.prisma.$transaction(async (prisma: PrismaClient) => {
        const account = await prisma.accounts.findUnique({
          where: { account_number: data.accountNumber },
          select: { id: true }
        });

        if (data.orderType == 'market') data.price = 0;

        // 주문 생성
        let submitOrder = await prisma.order.create({
          data: {
            account_id: account.id,
            stock_id: data.stockId,
            price: data.price,
            number: data.number,
            order_type: data.orderType,
            trading_type: 'sell',
          },
        });

        // Redis 주문 저장
        const unixTime = Date.now(); // 밀리초 단위

        jsonOrder = JSON.stringify(submitOrder, (_, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        );

        const score = data.price * 1_000_000_000_000 + unixTime;
        await this.redis.zadd(
          `orderbook:${data.stockId}:sell`,
          score,
          jsonOrder,
        );

        // 체결 가능 주문 탐색
        result = await this.ordersExecution.order(
          prisma,
          data,
          submitOrder,
          score
        );

        // 처리된 주문 Redis에서 삭제
        for (const score of result.sell) {
          await this.redis.zremrangebyscore(`orderbook:${data.stockId}:sell`, score, score);
        }
    
        for (const score of result.buy) {
          await this.redis.zremrangebyscore(`orderbook:${data.stockId}:buy`, score, score);
        }
      });
    } catch (err) {
      await this.redis.zrem(`orderbook:${data.stockId}:sell`, jsonOrder);

      console.error(err);
      throw new InternalServerErrorException('주문 처리중 오류가 발생했습니다');
    }

    // 웹소켓 전송
    try {
      // 주식 가격 전송
      await this.websocket.stockUpdate(data.stockId);

      // 주문 현황 업데이트 (미구현)

      // 주식을 보유한 사람들의 잔고 업데이트
      const userStocks = await this.prisma.user_stocks.findMany({
        where: {
          stock_id: data.stockId,
        },
      });
      for (let i = 0; i < userStocks.length; i++) {
        await this.websocket.accountUpdate(userStocks[i].account_id);
      }
    } catch (err) {
      console.error('웹소켓 전송오류' + err);
    }
  }

  // edit과 cancel redis 적용하기

  async edit(data: EditDto, user) {
    let result;

    // 주문 정정
    try {
      result = await this.prisma.order.update({
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
      await this.websocket.stockUpdate(result.stock_id);
      await this.websocket.accountUpdate(result.account_id);
      await this.websocket.orderStatus(result.account_id);
    } catch (err) {
      console.error('웹소켓 전송오류' + err);
    }
  }

  async cancel(data: CancelDto, user) {
    let order;

    // 취소 주문
    try {
      await this.prisma.$transaction(async () => {
        order = await this.prisma.order.update({
          data: {
            status: 'c',
          },
          where: {
            id: data.orderId,
          },
        });

        if (order.trading_type == 'sell') {
          const userStock = await this.prisma.user_stocks.findFirst({
            where: {
              stock_id: order.stock_id,
              account_id: order.account_id,
            },
          });

          await this.prisma.user_stocks.update({
            where: {
              id: userStock.id,
            },
            data: {
              can_number:
                userStock.can_number + order.number - order.match_number,
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
      await this.websocket.stockUpdate(order.stock_id);
      await this.websocket.accountUpdate(order.account_id);
      await this.websocket.orderStatus(order.account_id);
    } catch (err) {
      console.error('웹소켓 전송오류' + err);
    }
  }
}