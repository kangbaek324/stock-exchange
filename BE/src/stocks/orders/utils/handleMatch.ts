import { order, PrismaClient, TradingType, userStocks } from "@prisma/client";
import { orderCompleteUpdate, orderMatchAndRemainderUpdate, userStockDecrease, userStockIncrease } from "./orders.util";
import { BuyDto } from "../dtos/buy.dto";
import { SellDto } from "../dtos/sell.dto";

  // submit == find
  export async function handleEqualMatch(
    prisma: PrismaClient,
    submitOrder: order, 
    findOrder: order,
    tradingType: TradingType,
    submitOrderScore,
    findOrderScore,
    submitOrderNumber: bigint,
    findOrderNumber: bigint,
    searchCount: number,
    userStockList: { update: number[] }, // accountId 저장
    userStocks: Map<number, userStocks>, // accountId, user_stocks 객체
    orderToDelete
  ) {
    const increaseNumber = submitOrderNumber;
    const decreaseNumber = findOrderNumber;

    // 잔고 수정
    if (tradingType == 'buy') {
      [userStockList, userStocks] = await userStockIncrease(
        prisma, 
        submitOrder.stockId, submitOrder.accountId,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price
      );

      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        findOrder.stockId, findOrder.accountId,
        decreaseNumber,
        userStockList,
        userStocks,
        true
      );

      orderToDelete.buy.push(submitOrderScore);
      orderToDelete.sell.push(findOrderScore[searchCount + 1]);
    } else {
      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        submitOrder.stockId, submitOrder.accountId,
        decreaseNumber,
        userStockList,
        userStocks,
        false
      );

      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        findOrder.stockId, findOrder.accountId,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price
      );

      orderToDelete.buy.push(findOrderScore[searchCount + 1]);
      orderToDelete.sell.push(submitOrderScore);
    }

    return [userStockList, userStocks, orderToDelete];
  }

  // submit < find
  export async function handleRemainingMatch(
    prisma: PrismaClient,
    data: BuyDto | SellDto,
    submitOrder: order, 
    findOrder: order,
    tradingType: TradingType,
    submitOrderScore,
    submitOrderNumber: bigint,
    userStockList: { update: number[] }, // accountId 저장
    userStocks: Map<number, userStocks>, // accountId, user_stocks 객체
    orderToDelete,
    redisKey: string
  ) {
    const increaseNumber = submitOrderNumber;
    const decreaseNumber = submitOrderNumber;

    // 잔고 수정
    if (tradingType == 'buy') {
      //
      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        submitOrder.stockId, submitOrder.accountId,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price
      );

      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        findOrder.stockId, findOrder.accountId,
        decreaseNumber,
        userStockList,
        userStocks,
        true
      );
      redisKey = `orderbook:${data.stockId}:sell`;
      orderToDelete.buy.push(submitOrderScore);
    } else {
      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        submitOrder.stockId, submitOrder.accountId,
        decreaseNumber,
        userStockList,
        userStocks,
        false
      );

      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        findOrder.stockId, findOrder.accountId,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price
      )

      redisKey = `orderbook:${data.stockId}:buy`;
      orderToDelete.sell.push(submitOrderScore);
    }

    return [userStockList, userStocks, orderToDelete, redisKey];
  }

  // submit > find
  export async function handlePartialMatch(    
    prisma: PrismaClient,
    submitOrder: order, 
    findOrder: order,
    tradingType: TradingType,
    findOrderNumber: bigint,
    findOrderScore: bigint,
    userStockList: { update: number[] }, // accountId 저장
    userStocks: Map<number, userStocks>, // accountId, user_stocks 객체
    orderToDelete,
    searchCount: number
  ) {
    const order = [findOrder];
    const increaseNumber = findOrderNumber;
    const decreaseNumber = findOrderNumber;

    // 잔고 수정
    if (tradingType == 'buy') {
      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        submitOrder.stockId, submitOrder.accountId,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price
      );

      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        findOrder.stockId, findOrder.accountId,
        decreaseNumber,
        userStockList,
        userStocks,
        true
      );

      orderToDelete.sell.push(findOrderScore[searchCount + 1]);
    } else {
      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        submitOrder.stockId, submitOrder.accountId,
        decreaseNumber,
        userStockList,
        userStocks,
        false
      );

      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        findOrder.stockId, findOrder.accountId,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price
      );

      orderToDelete.buy.push(findOrderScore[searchCount + 1]);
    }

    await orderCompleteUpdate(prisma, order, findOrder.number);
    await orderMatchAndRemainderUpdate(
      prisma,
      submitOrder,
      findOrder,
    );

    return [userStockList, userStocks, orderToDelete];
  }