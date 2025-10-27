import { order, PrismaClient, user_stocks } from "@prisma/client";
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

/**
 * 
 * @param order 
 * @returns Json으로 변환된 order을 반환
 */
export function orderToJson(order) {
     return JSON.stringify(order, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
    );
}

/**
 * 
 * @param prisma 
 * @param stockId 
 * @param accountId 
 * @param increaseNumber 
 * @param userStockList 
 * @param userStocks 
 * @param buyPrice 
 * @returns userStockList, userStocks를 담은 배열로 반환
 */
export async function userStockIncrease(
    prisma: PrismaClient,
    stockId: number,
    accountId: number,
    increaseNumber: bigint,
    userStockList: { update: number[] }, // accountId 저장
    userStocks: Map<number, user_stocks>, // accountId, user_stocks 객체
    buyPrice: number
): Promise<[{ update: number[] }, Map<number, user_stocks>]> {
    const userStock = userStocks.get(accountId);

    // 첫 매수
    if (!userStock) {
        userStocks.set(accountId, await prisma.user_stocks.create({
            data : {
                account_id: accountId,
                stock_id: stockId,
                number: increaseNumber,
                can_number: increaseNumber,
                average: buyPrice, 
                total_buy_amount: BigInt(buyPrice) * increaseNumber
            }
        }));
    }
    else {
        userStocks.set(accountId, {
            ...userStock,
            number: userStock.number + increaseNumber,
            can_number: userStock.can_number + increaseNumber,
            average: Number(((BigInt(userStock.average) * userStock.number) + (BigInt(buyPrice) * increaseNumber)) / (userStock.number + increaseNumber)),
            total_buy_amount: userStock.total_buy_amount + BigInt(buyPrice) * increaseNumber
        });

        userStockList.update.push(accountId);
    }

    return [userStockList, userStocks];
}

/**
 * 
 * @param prisma 
 * @param stockId 
 * @param accountId 
 * @param decreaseNumber 
 * @param userStockList 
 * @param userStocks 
 * @param isFindOrder 
 * @returns userStockList, userStocks를 담은 배열로 반환
 */
export async function userStockDecrease(
    prisma: PrismaClient,
    stockId: number,
    accountId: number,
    decreaseNumber: bigint,
    userStockList: { update: number[] }, // accountId 저장
    userStocks: Map<number, user_stocks>, // accountId, user_stocks 객체
    isFindOrder: boolean
): Promise<[{ update: number[] }, Map<number, user_stocks>]> {
    const userStock = userStocks.get(accountId);

    // 더 이상 보유 수량이 없을때
    if (userStock.number - decreaseNumber == 0n) {
        await prisma.user_stocks.delete({
            where : { 
                account_id_stock_id: {
                    account_id: accountId,
                    stock_id: stockId
                } 
            }
        });
    }
    else {
        userStocks.set(accountId, {
            ...userStock,
            number: userStock.number - decreaseNumber,
            can_number: isFindOrder 
                ? userStock.can_number
                : userStock.can_number - decreaseNumber,
            total_buy_amount: userStock.total_buy_amount - (BigInt(userStock.average) * decreaseNumber)
        });

        userStockList.update.push(accountId);
    }

    return [userStockList, userStocks];
}

/**
 * 체결되고 난뒤 잔여 수량 업데이트
 * @param prisma 
 * @param remainderOrder 
 * @param completeOrder 
 */
export async function orderMatchAndRemainderUpdate(prisma, remainderOrder, completeOrder) {
    await prisma.order.update({
        where: {
            id: remainderOrder.id
        },
        data: {
            match_number: remainderOrder.match_number + (completeOrder.number - completeOrder.match_number)
        }
    });
}

/**
 *  * 주문 상태 업데이트
 * 
 * 배열의 크기는 최소1개 최대 2개
 * 주문이 한가지일 경우에는 number에 업데이트될 수량을 매게변수로 받음
 * 
 * @param prisma 
 * @param orders 
 * @param number 
 */
export async function orderCompleteUpdate(prisma, orders, number?: bigint) {
    if (orders.length == 2) {
        for(let i = 0; i < orders.length; i++) {
            await prisma.order.update({
                where: {
                    id: orders[i].id
                },
                data: {
                    status: "y",
                    match_number: orders[i].number
                }
            });
        }
    } else if (orders.length == 1) {
        await prisma.order.update({
            where: {
                id: orders[0].id
            },
            data: {
                status: "y",
                match_number: number
            }
        });
    }
    else throw new Error("올바르지 않은 배열 크기입니다")
}

/**
 * 
 * 체결된 가격으로 주식가격 업데이트
 * @param prisma 
 * @param data 
 * @param updatePrice 
 */
export async function stockPriceUpdate(prisma: PrismaClient, data, updatePrice) {
    await prisma.stocks.update({
        where: { id : data.stockId },
        data: {
            price : updatePrice
        }
    });

    const today = dayjs().utc().format("YYYY-MM-DD");
    const stockHistory = await prisma.stock_history.findUnique({
        where: {
            stock_id_date: {
                stock_id: data.stockId,
                date: new Date(today)
            }
        }
    });

    if (!stockHistory) {
        await prisma.stock_history.create({
            data: {
                stock_id: data.stockId,
                date: new Date(today),
                low: updatePrice,
                high: updatePrice,
                close: updatePrice,
                open: updatePrice
            }
        })
    }
    else {        
        if (stockHistory.low > updatePrice) {
            await prisma.stock_history.update({
                where: {
                    stock_id_date: {
                        stock_id: data.stockId,
                        date: new Date(today)
                    }
                },
                data: {
                    low: updatePrice
                }
            });
        }
        if (stockHistory.high < updatePrice) {
            await prisma.stock_history.update({
                where: {
                    stock_id_date: {
                        stock_id: data.stockId,
                        date: new Date(today)
                    }
                },
                data: {
                    high: updatePrice
                }
            });
        }
    
        await prisma.stock_history.update({
            where: {
                stock_id_date: {
                    stock_id: data.stockId,
                    date: new Date(today)
                }
            },
            data: {
                close: updatePrice
            }
        });
    }
}

export function createOrderMatch(data, submitOrder, findOrder, isFindOrderBigger?: boolean) {
    // 3번째 경우의 수: 제출한 주문의 수가 더 클때, 찾은 주문의 수가 모두 체결된것이기에 찾은 주문을 기준으로 number를 맞춰야 함
    if (isFindOrderBigger) {
        return {
            stock_id: data.stockId,
            number: findOrder.number - findOrder.match_number,
            initial_order_id: findOrder.id,
            order_id: submitOrder.id
        }
    } else {
        return {
            stock_id: data.stockId,
            number: submitOrder.number - submitOrder.match_number,
            initial_order_id: findOrder.id,
            order_id: submitOrder.id
        }
    }
}