import { order, PrismaClient, TradingType, userStocks } from "@prisma/client";
import { orderCompleteUpdate, orderMatchAndRemainderUpdate, userStockDecrease, userStockIncrease } from "./orders.util";

  // submit == find
  export async function handleEqualMatch(
    prisma: PrismaClient,
    submitOrder: order,
    findOrder: order,
    tradingType: TradingType,
    submitOrderNumber: bigint,
    findOrderNumber: bigint,
    userStockList: { update: number[] }, // accountId 저장
    userStocks: Map<number, userStocks>, // accountId, user_stocks 객체
  ): Promise<[{ update: number[] }, Map<number, userStocks>]> {
    const increaseNumber = submitOrderNumber;
    const decreaseNumber = findOrderNumber;

    // 잔고 수정
    if (tradingType == 'buy') {
      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        submitOrder.stockId,
        submitOrder.accountId,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price,
      );

      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        findOrder.stockId,
        findOrder.accountId,
        decreaseNumber,
        userStockList,
        userStocks,
        true,
      );
    } else {
      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        submitOrder.stockId,
        submitOrder.accountId,
        decreaseNumber,
        userStockList,
        userStocks,
        false,
      );

      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        findOrder.stockId,
        findOrder.accountId,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price,
      );
    }

    return [userStockList, userStocks];
  }

  // submit < find
  export async function handleRemainingMatch(
    prisma: PrismaClient,
    submitOrder: order,
    findOrder: order,
    tradingType: TradingType,
    submitOrderNumber: bigint,
    userStockList: { update: number[] }, // accountId 저장
    userStocks: Map<number, userStocks>, // accountId, user_stocks 객체
  ): Promise<[{ update: number[] }, Map<number, userStocks>]> {
    const increaseNumber = submitOrderNumber;
    const decreaseNumber = submitOrderNumber;

    // 잔고 수정
    if (tradingType == 'buy') {
      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        submitOrder.stockId,
        submitOrder.accountId,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price,
      );

      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        findOrder.stockId,
        findOrder.accountId,
        decreaseNumber,
        userStockList,
        userStocks,
        true,
      );
    } else {
      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        submitOrder.stockId,
        submitOrder.accountId,
        decreaseNumber,
        userStockList,
        userStocks,
        false,
      );

      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        findOrder.stockId,
        findOrder.accountId,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price,
      );
    }

    return [userStockList, userStocks];
  }

  // submit > find
  export async function handlePartialMatch(
    prisma: PrismaClient,
    submitOrder: order,
    findOrder: order,
    tradingType: TradingType,
    findOrderNumber: bigint,
    userStockList: { update: number[] }, // accountId 저장
    userStocks: Map<number, userStocks>, // accountId, user_stocks 객체
  ): Promise<[{ update: number[] }, Map<number, userStocks>]> {
    const order = [findOrder];
    const increaseNumber = findOrderNumber;
    const decreaseNumber = findOrderNumber;

    // 잔고 수정
    if (tradingType == 'buy') {
      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        submitOrder.stockId,
        submitOrder.accountId,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price,
      );

      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        findOrder.stockId,
        findOrder.accountId,
        decreaseNumber,
        userStockList,
        userStocks,
        true,
      );
    } else {
      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        submitOrder.stockId,
        submitOrder.accountId,
        decreaseNumber,
        userStockList,
        userStocks,
        false,
      );

      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        findOrder.stockId,
        findOrder.accountId,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price,
      );
    }

    await orderCompleteUpdate(prisma, order, findOrder.number);
    await orderMatchAndRemainderUpdate(prisma, submitOrder, findOrder);

    return [userStockList, userStocks];
  }