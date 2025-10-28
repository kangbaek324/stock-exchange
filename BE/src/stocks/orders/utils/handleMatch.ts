import { order, PrismaClient, TradingType } from "@prisma/client";
import { orderCompleteUpdate, orderMatchAndRemainderUpdate, userStockDecrease, userStockIncrease } from "./orders.util";

  // submit == find
  export async function handleEqualMatch(
    prisma: PrismaClient,
    submitOrder: order, 
    findOrder: order,
    tradingType: TradingType,
    submitOrderScore,
    findOrderScore,
    submitOrderNumber,
    findOrderNumber,
    searchCount,
    userStockList, 
    userStocks,
    orderToDelete
  ) {
    const increaseNumber = submitOrderNumber;
    const decreaseNumber = findOrderNumber;

    // 잔고 수정
    if (tradingType == 'buy') {
      [userStockList, userStocks] = await userStockIncrease(
        prisma, 
        submitOrder.stock_id, submitOrder.account_id,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price
      );

      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        findOrder.stock_id, findOrder.account_id,
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
        submitOrder.stock_id, submitOrder.account_id,
        decreaseNumber,
        userStockList,
        userStocks,
        false
      );

      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        findOrder.stock_id, findOrder.account_id,
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
    data,
    submitOrder: order, 
    findOrder: order,
    tradingType: TradingType,
    submitOrderScore,
    submitOrderNumber,
    userStockList, 
    userStocks,
    orderToDelete,
    redisKey
  ) {
    const increaseNumber = submitOrderNumber;
    const decreaseNumber = submitOrderNumber;

    // 잔고 수정
    if (tradingType == 'buy') {
      //
      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        submitOrder.stock_id, submitOrder.account_id,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price
      );

      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        findOrder.stock_id, findOrder.account_id,
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
        submitOrder.stock_id, submitOrder.account_id,
        decreaseNumber,
        userStockList,
        userStocks,
        false
      );

      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        findOrder.stock_id, findOrder.account_id,
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
    findOrderNumber,
    findOrderScore,
    userStockList, 
    userStocks,
    orderToDelete,
    searchCount
  ) {
    const order = [findOrder];
    const increaseNumber = findOrderNumber;
    const decreaseNumber = findOrderNumber;

    // 잔고 수정
    if (tradingType == 'buy') {
      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        submitOrder.stock_id, submitOrder.account_id,
        increaseNumber,
        userStockList,
        userStocks,
        findOrder.price
      );

      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        findOrder.stock_id, findOrder.account_id,
        decreaseNumber,
        userStockList,
        userStocks,
        true
      );

      orderToDelete.sell.push(findOrderScore[searchCount + 1]);
    } else {
      [userStockList, userStocks] = await userStockDecrease(
        prisma,
        submitOrder.stock_id, submitOrder.account_id,
        decreaseNumber,
        userStockList,
        userStocks,
        false
      );

      [userStockList, userStocks] = await userStockIncrease(
        prisma,
        findOrder.stock_id, findOrder.account_id,
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