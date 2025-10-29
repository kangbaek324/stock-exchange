import { Injectable } from '@nestjs/common';
import { BuyDto } from './dtos/buy.dto';
import { SellDto } from './dtos/sell.dto';
import { order, PrismaClient, TradingType, userStocks } from '@prisma/client';
import * as utils from './utils/orders.util';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { handleEqualMatch, handlePartialMatch } from './utils/handleMatch';
import { handleRemainingMatch } from './utils/handleMatch';

@Injectable()
export class OrdersExecutionService {
  private readonly redis: Redis | null;
  constructor(
    private readonly redisService: RedisService,
  ) {
    this.redis = this.redisService.getOrThrow();
  }

  // 체결할 주문 검색
  async findOrder(
    prisma: PrismaClient, 
    data: BuyDto | SellDto, 
    tradingType: TradingType, 
    searchCount: number
  ) {
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
        rs.matchNumber = BigInt(rs.matchNumber);
        rs.number = BigInt(rs.number);
        rs.price = BigInt(rs.price);

        if (rs.price > price && orderType == "limit") return null;

        return [rs, redisOrder];
      }

      case 'sell': {
        redisOrder = await this.redis.zrevrange('orderbook:1:buy', 0, -1, 'WITHSCORES'); // 높은 가격 먼저
        if (!redisOrder[searchCount]) break;

        
        const rs = JSON.parse(redisOrder[searchCount]);
        rs.matchNumber = BigInt(rs.matchNumber);
        rs.number = BigInt(rs.number);
        rs.price = BigInt(rs.price);

        if (rs.price < price && orderType == "limit") return null;

        return [rs, redisOrder];
      }
    }

    // 없을경우 DB 직접 조회
    let sql = `
        SELECT id, account_id, price, number, match_number
        FROM \`order\`
        WHERE stock_id = ? AND trading_type = ? AND status = 'n'
    `;

    const params: (number | string)[] = [stockId];
    
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

    const [order] = await prisma.$queryRawUnsafe(sql, ...params) as any[];

    const returnValue = [order, 0];
    return returnValue ?? null;
  }

  // 체결이 끝난후 후 처리
  async finalizeTradeResult(
    prisma: PrismaClient,
    data: BuyDto | SellDto, 
    userStockList: { update: number[] }, 
    userStocks: Map<number, userStocks>, 
    createMatchList, 
    nextStockPrice: number
  ) {
    // 주식 가격 업데이트
    await utils.stockPriceUpdate(prisma, data, nextStockPrice);
    await this.redis.set(`stockPrice:${data.stockId}`, nextStockPrice);

    // 체결 로그 업데이트
    await prisma.orderMatch.createMany({ data: createMatchList });

    // 계좌 잔고 업데이트
    for(const accountId of userStockList.update) {
      await prisma.userStocks.update({
        where: { 
          accountId_stockId: {
            accountId: accountId,
            stockId: data.stockId
          }
        },
        data: userStocks.get(accountId)
      });
    }
  }

  async processSubmitOrder(
    prisma: PrismaClient,
    data: BuyDto | SellDto,
    submitOrder: order,
    submitOrderScore: number,
  ) {
    const tradingType = submitOrder.tradingType;
    let findOrder: order, findOrderScore, nextStockPrice, searchCount = 0;
    let orderToDelete = { sell: [], buy: [] };
    let createMatchList = []; 
    const accountUpdateList = [submitOrder.accountId];
    const isInAccountUpdateList = new Map<number, boolean>();
    isInAccountUpdateList.set(submitOrder.accountId, true);

    let userStockList: { update: number[] } = { update: [] }; // accountId 저장
    let userStocks = new Map<number, userStocks>(); // accountId, user_stocks 객체, 이름 stocks로 바꿔야됨

    // 메모리에 제출한 주문 등록
    if (!userStocks.get(submitOrder.accountId)) {
      const userStockForSubmitOrder = await prisma.userStocks.findUnique({
        where: { 
          accountId_stockId: {
            accountId: submitOrder.accountId,
            stockId: submitOrder.stockId
          }
        }
      });

      userStocks.set(submitOrder.accountId, userStockForSubmitOrder);
    }

    while (true) {
      // 체결할 주문 찾기
      const findOrderOrigin = await this.findOrder(prisma, data, tradingType, searchCount);

      // 체결할 주문이 있다면
      if (findOrderOrigin !== null && findOrderOrigin[0]) {
        // 찾은 주문
        findOrder = findOrderOrigin[0];
        findOrderScore = findOrderOrigin[1]; // score 조회방법: searchCount + 1

        // 찾은 주문 메모리에 저장
        if (!userStocks.get(findOrder.accountId)) {
          const userStockForFindOrder = await prisma.userStocks.findUnique({
            where: { 
              accountId_stockId: {
                accountId: findOrder.accountId,
                stockId: findOrder.stockId
              }
            }
          });
  
          userStocks.set(findOrder.accountId, userStockForFindOrder);
        }

        // 체결 가능한 수량
        const submitOrderNumber = submitOrder.number - submitOrder.matchNumber;
        const findOrderNumber = findOrder.number - findOrder.matchNumber;

        // 체결
        if (submitOrderNumber == findOrderNumber) {
          const order = [findOrder, submitOrder];

          [userStockList, userStocks, orderToDelete] = await handleEqualMatch(prisma, 
            submitOrder, 
            findOrder, 
            tradingType, 
            submitOrderScore, 
            findOrderScore, 
            submitOrderNumber, 
            findOrderNumber, 
            searchCount, 
            userStockList, 
            userStocks, 
            orderToDelete
          );

          await utils.orderCompleteUpdate(prisma, order);
          createMatchList.push(utils.createOrderMatch(data, submitOrder, findOrder));
          nextStockPrice = findOrder.price;

          if (!isInAccountUpdateList.get(findOrder.accountId)) {
            accountUpdateList.push(findOrder.accountId);

            isInAccountUpdateList.set(findOrder.accountId, true);
          }

          break;
        } else if (submitOrderNumber < findOrderNumber) {
          const order = [submitOrder];
          let redisKey;
          
          [userStockList, userStocks, orderToDelete, redisKey] = await handleRemainingMatch(
            prisma,
            data,
            submitOrder,
            findOrder,
            tradingType,
            submitOrderScore,
            submitOrderNumber,
            userStockList,
            userStocks,
            orderToDelete,
            redisKey
          );

          await utils.orderCompleteUpdate(prisma, order, submitOrder.number);
          await utils.orderMatchAndRemainderUpdate(
            prisma,
            findOrder,
            submitOrder,
          );
          createMatchList.push(utils.createOrderMatch(data, submitOrder, findOrder));
          const score = findOrderScore[searchCount + 1];
          findOrder.matchNumber = findOrder.matchNumber + (submitOrder.number - submitOrder.matchNumber)
          await this.redis.zremrangebyscore(redisKey, score, score);
          await this.redis.zadd(redisKey, score, utils.orderToJson(findOrder));

          nextStockPrice = findOrder.price;

          if (!isInAccountUpdateList.get(findOrder.accountId)) {
            accountUpdateList.push(findOrder.accountId);

            isInAccountUpdateList.set(findOrder.accountId, true);
          }

          break;
        } else if (submitOrderNumber > findOrderNumber) {
          [userStockList, userStocks, orderToDelete] = await handlePartialMatch(
            prisma,
            submitOrder,
            findOrder,
            tradingType,
            findOrderNumber,
            findOrderScore,
            userStockList,
            userStocks,
            orderToDelete,
            searchCount
          );

          createMatchList.push(utils.createOrderMatch(data, submitOrder, findOrder, true));
          nextStockPrice = findOrder.price;

          if (!isInAccountUpdateList.get(findOrder.accountId)) {
            accountUpdateList.push(findOrder.accountId);

            isInAccountUpdateList.set(findOrder.accountId, true);
          }

          submitOrder.matchNumber =
            submitOrder.matchNumber +
            (findOrder.number - findOrder.matchNumber);

          searchCount = searchCount + 2;
        }
      } 
      else { // 체결할 주문이 없다면
        // 더이상 체결할 주문이 없거나 / 즉시 체결가능한 주문이 없는경우
        // 유저가 가진 주식 조회
        let userStock = userStocks.get(submitOrder.accountId);
        if (!userStock) {
          userStock = await prisma.userStocks.findUnique({
            where: { 
              accountId_stockId: {
                accountId: submitOrder.accountId,
                stockId: submitOrder.stockId
              }
            }
          });
        }

        // 시장가 주문중 미체결이 있는 경우
        if (
          submitOrder.number != submitOrder.matchNumber &&
          submitOrder.orderType == 'market'
        ) {
          // DB 취소
          await prisma.order.update({
            where: { id: submitOrder.id },
            data: { 
              status: 'c'
            },
          });

          // Redis 취소
          const redisKey =
            tradingType == 'buy'
              ? `orderbook:${data.stockId}:buy`
              : `orderbook:${data.stockId}:sell`;
              
          await this.redis.zremrangebyscore(redisKey, submitOrderScore, submitOrderScore);

          break;
        }

        // 매도 주문시 가능수량 업데이트
        if (tradingType == 'sell') {
          userStock.canNumber = userStock.canNumber - (submitOrder.number - submitOrder.matchNumber);
          userStocks.set(submitOrder.accountId, userStock);

          userStockList.update.push(submitOrder.accountId);
        }
        
        // 지정가 매매에 대해서 남은 수량 Redis 업데이트
        const redisKey =
          tradingType == 'buy'
            ? `orderbook:${data.stockId}:buy`
            : `orderbook:${data.stockId}:sell`;

        // Redis 남은 주문 업데이트
        await this.redis.zremrangebyscore(redisKey, submitOrderScore, submitOrderScore);
        await this.redis.zadd(redisKey, submitOrderScore, utils.orderToJson(submitOrder));

        if (!nextStockPrice) {
          // @TODO Redis 적용하기
          const stock = await prisma.stocks.findUnique({
            where: { id: data.stockId }
          });

          nextStockPrice = stock.price;
        }

        break;
      }
    }

    // 후처리
    await this.finalizeTradeResult(
      prisma,
      data,
      userStockList,
      userStocks,
      createMatchList,
      nextStockPrice
    );

    return [orderToDelete, accountUpdateList];
  }
}