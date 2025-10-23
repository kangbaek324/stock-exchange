import { Injectable } from '@nestjs/common';
import { BuyDto } from './dtos/buy.dto';
import { SellDto } from './dtos/sell.dto';
import { PrismaClient } from '@prisma/client';
import * as utils from './utils/orders.util';
import { WebsocketGateway } from 'src/websocket/websocket.gateway';
import { RedisService } from '@liaoliaots/nestjs-redis';

// interface OrderInterface {
//   account_id: number,
//   stock_id: number,
//   price: number,
//   number: number,
//   order_type: 'buy' | 'sell',
//   trading_type: 'market' | 'limit'
// }

@Injectable()
export class OrdersExecutionService {
  constructor(
    private readonly websocket: WebsocketGateway,
    private readonly redisService: RedisService,
  ) {}

  // 체결할 주문 검색
  async findOrder(prisma, data, tradingType) {
    const stockId = data.stockId;
    const orderType = data.orderType;
    const price = data.price;

    // 1. 체결할 주문을 조회한다
    // 1-1. sell, limt일 경우 buy, price가 더 큰거 선택
    // 1-2. buy, limit일 경우 sell, price가 낮은거 선택

    let sql = `
        SELECT id, account_id, price, number, match_number
        FROM \`order\`
        WHERE stock_id = ? AND trading_type = ? AND status = 'n'
    `;

    const params = [stockId];

    if (tradingType === 'sell') {
      params.push('buy');
      if (orderType === 'limit') {
        sql += ` AND price >= ?`;
        params.push(price);
      }
      sql += ` ORDER BY price DESC, created_at ASC LIMIT 1 FOR UPDATE`;
    } else if (tradingType === 'buy') {
      params.push('sell');
      if (orderType === 'limit') {
        sql += ` AND price <= ?`;
        params.push(price);
      }
      sql += ` ORDER BY price ASC, created_at ASC LIMIT 1 FOR UPDATE`;
    }

    const [order] = await prisma.$queryRawUnsafe(sql, ...params);
    return order ?? null;
  }

  async order(
    prisma: PrismaClient,
    data: BuyDto | SellDto,
    submitOrder,
    tradingType,
  ): Promise<any> {
    let findOrder;
    while (true) {
      findOrder = await this.findOrder(prisma, data, tradingType);

      if (findOrder) {
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

    if (!findOrder) {
      return [null, submitOrder.account_id];
    } else {
      return [findOrder.account_id, submitOrder.account_id];
    }
  }
}
