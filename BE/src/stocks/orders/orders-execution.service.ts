import { Injectable } from '@nestjs/common';
import { BuyDto } from './dtos/buy.dto';
import { SellDto } from './dtos/sell.dto';
import { PrismaClient } from '@prisma/client';
import * as utils from './utils/orders.util';
import { WebsocketGateway } from 'src/websocket/websocket.gateway';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

@Injectable()
export class OrdersExecutionService {
  private readonly redis: Redis | null;
  constructor(
    private readonly websocket: WebsocketGateway,
    private readonly redisService: RedisService,
  ) {
    this.redis = this.redisService.getOrThrow();
  }

  // 체결할 주문 검색
  async findOrder(prisma, data, tradingType, searchCount) {
    const stockId = data.stockId;
    const orderType = data.orderType;
    const price = data.price;

    let redisOrder;

    // Redis 조회
    switch (tradingType) {
      case 'buy': {
        redisOrder = await this.redis.zrange('orderbook:1:sell', 0, -1, 'WITHSCORES'); // 낮은 가격 먼저
        if (!redisOrder[searchCount]) break;

        const rs = JSON.parse(redisOrder[searchCount]);
        rs.match_number = BigInt(rs.match_number);
        rs.number = BigInt(rs.number);

        if (rs.price > price) return null;

        return [rs, redisOrder];
      }

      case 'sell': {
        redisOrder = await this.redis.zrevrange('orderbook:1:buy', 0, -1, 'WITHSCORES'); // 높은 가격 먼저
        if (!redisOrder[searchCount]) break;
        
        const rs = JSON.parse(redisOrder[searchCount]);
        rs.match_number = BigInt(rs.match_number);
        rs.number = BigInt(rs.number);

        if (rs.price < price) return null;

        return [rs, redisOrder];
      }
    }

    // 없을경우 DB 직접 조회
    if (!redisOrder[searchCount]) {
      let sql = `
          SELECT id, account_id, price, number, match_number
          FROM \`order\`
          WHERE stock_id = ? AND trading_type = ? AND status = 'n'
      `;
  
      const params = [stockId];
      
      switch (tradingType) {
        case 'buy': {
          params.push('sell');
          if (orderType === 'limit') {
            sql += ` AND price <= ?`;
            params.push(price);
          }
          sql += ` ORDER BY price ASC, created_at ASC LIMIT 1 FOR UPDATE`;

          break;
        }

        case 'sell': {
          params.push('buy');
          if (orderType === 'limit') {
            sql += ` AND price >= ?`;
            params.push(price);
          }
          sql += ` ORDER BY price DESC, created_at ASC LIMIT 1 FOR UPDATE`;

          break;
        }
      }
  
      const [order] = await prisma.$queryRawUnsafe(sql, ...params);

      const returnValue = [order, 1];
      return returnValue ?? null;
    }
  }

  async order(
    prisma: PrismaClient,
    data: BuyDto | SellDto,
    submitOrder,
    submitOrderScore: number,
    tradingType,
  ): Promise<any> {
    let findOrder, findOrderScore;
    let searchCount = 0;
    const orderToDelete = {
      sell: [],
      buy: [],
    };

    while (true) {
      const findOrderOrigin = await this.findOrder(prisma, data, tradingType, searchCount);

      if (findOrderOrigin[0]) {
        findOrder = findOrderOrigin[0];
        findOrderScore = findOrderOrigin[1]; // score 조회방법: searchCount + 1
        // 체결 가능한 수량
        const submitOrderNumber = submitOrder.number - submitOrder.match_number;
        const findOrderNumber = findOrder.number - findOrder.match_number;

        if (submitOrderNumber == findOrderNumber) {
          const order = [findOrder, submitOrder];
          // 잔고 수정
          if (tradingType == 'buy') {
            await utils.accountUpdate(
              prisma,
              data.stockId,
              submitOrder.account_id,
              submitOrderNumber,
              'increase',
              false,
              findOrder.price,
            );

            await utils.accountUpdate(
              prisma,
              data.stockId,
              findOrder.account_id,
              submitOrderNumber,
              'decrease',
              true,
            );

            orderToDelete.buy.push(submitOrderScore);
            orderToDelete.sell.push(findOrderScore[searchCount + 1]);
          } else {
            await utils.accountUpdate(
              prisma,
              data.stockId,
              submitOrder.account_id,
              submitOrderNumber,
              'decrease',
              false,
            );

            await utils.accountUpdate(
              prisma,
              data.stockId,
              findOrder.account_id,
              submitOrderNumber,
              'increase',
              false,
              findOrder.price,
            );

            orderToDelete.buy.push(findOrderScore[searchCount + 1]);
            orderToDelete.sell.push(submitOrderScore);
          }
          await utils.orderCompleteUpdate(prisma, order);
          await utils.createOrderMatch(prisma, data, submitOrder, findOrder, 1);
          await utils.stockPriceUpdate(prisma, data, findOrder.price);

          await this.websocket.accountUpdate(submitOrder.account_id);
          await this.websocket.accountUpdate(findOrder.account_id);

          break;
        } else if (submitOrderNumber < findOrderNumber) {
          const order = [submitOrder];
          // 잔고 수정
          if (tradingType == 'buy') {
            await utils.accountUpdate(
              prisma,
              data.stockId,
              submitOrder.account_id,
              submitOrderNumber,
              'increase',
              false,
              findOrder.price,
            );

            await utils.accountUpdate(
              prisma,
              data.stockId,
              findOrder.account_id,
              submitOrderNumber,
              'decrease',
              true,
            );

            const score = findOrderScore[searchCount + 1];
            const redisKey = `orderbook:${data.stockId}:sell`;
            findOrder.match_number = findOrder.match_number; + (submitOrder.number - submitOrder.match_number);

            await this.redis.zremrangebyscore(redisKey, score, score);
            await this.redis.zadd(redisKey, score, utils.orderToJson(findOrder));

            orderToDelete.buy.push(submitOrderScore);
          } else {
            await utils.accountUpdate(
              prisma,
              data.stockId,
              submitOrder.account_id,
              submitOrderNumber,
              'decrease',
              false,
            );

            await utils.accountUpdate(
              prisma,
              data.stockId,
              findOrder.account_id,
              submitOrderNumber,
              'increase',
              false,
              findOrder.price,
            );

            const score = findOrderScore[searchCount + 1];
            const redisKey = `orderbook:${data.stockId}:buy`;
            findOrder.match_number = findOrder.match_number; + (submitOrder.number - submitOrder.match_number);

            await this.redis.zremrangebyscore(redisKey, score, score);
            await this.redis.zadd(redisKey, score, utils.orderToJson(findOrder));

            orderToDelete.sell.push(submitOrderScore);
          }
          await utils.orderCompleteUpdate(prisma, order, submitOrder.number);
          await utils.orderMatchAndRemainderUpdate(
            prisma,
            findOrder,
            submitOrder,
          );
          await utils.createOrderMatch(prisma, data, submitOrder, findOrder, 2);
          await utils.stockPriceUpdate(prisma, data, findOrder.price);

          await this.websocket.accountUpdate(submitOrder.account_id);
          await this.websocket.accountUpdate(findOrder.account_id);

          break;
        } else if (submitOrderNumber > findOrderNumber) {
          const order = [findOrder];

          // 잔고 수정
          if (tradingType == 'buy') {
            await utils.accountUpdate(
              prisma,
              data.stockId,
              submitOrder.account_id,
              findOrderNumber,
              'increase',
              false,
              findOrder.price,
            );

            await utils.accountUpdate(
              prisma,
              data.stockId,
              findOrder.account_id,
              findOrderNumber,
              'decrease',
              true,
            );

            orderToDelete.sell.push(findOrderScore[searchCount + 1]);
          } else {
            await utils.accountUpdate(
              prisma,
              data.stockId,
              submitOrder.account_id,
              findOrderNumber,
              'decrease',
              false,
            );

            await utils.accountUpdate(
              prisma,
              data.stockId,
              findOrder.account_id,
              findOrderNumber,
              'increase',
              false,
              findOrder.price,
            );

            orderToDelete.buy.push(findOrderScore[searchCount + 1]);
          }

          await utils.orderCompleteUpdate(prisma, order, findOrder.number);
          await utils.orderMatchAndRemainderUpdate(
            prisma,
            submitOrder,
            findOrder,
          );
          await utils.createOrderMatch(prisma, data, submitOrder, findOrder, 3);
          await utils.stockPriceUpdate(prisma, data, findOrder.price);

          submitOrder.match_number =
            submitOrder.match_number +
            (findOrder.number - findOrder.match_number);

          searchCount = searchCount + 2;
        }
      } else {
        // 더이상 체결할 주문이 없거나 / 즉시 체결가능한 주문이 없는경우

        // 유저가 가진 주식 조회
        const userStocks = await prisma.user_stocks.findFirst({
          where: { account_id: submitOrder.account_id, stock_id: data.stockId },
        });

        // 매도주문 -> 체결할 주문이 없음
        if (tradingType == 'sell') {
          await prisma.user_stocks.update({
            where: { id: userStocks.id },
            data: {
              can_number:
                userStocks.can_number -
                BigInt(submitOrder.number - submitOrder.match_number),
            },
          });
        }

        // 시장가 주문 -> 일부체결시 지정가로 전환
        if (
          submitOrder.number != submitOrder.match_number &&
          submitOrder.order_type == 'market'
        ) {
          // 현재 주식 가격 조회
          const stockPriceNow = await prisma.stocks.findUnique({
            where: { id: submitOrder.stock_id },
            select: { price: true },
          });

          await prisma.order.update({
            where: { id: submitOrder.id },
            data: { price: stockPriceNow.price },
          });
        }

        break;
      }
    }

    return orderToDelete;
  }
}
