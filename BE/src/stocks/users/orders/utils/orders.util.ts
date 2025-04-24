import { order, PrismaClient } from "@prisma/client";
import { Order } from "../interfaces/order.interface";

/**
 * 주문제출
 */
export async function submitOrder(prisma, submitOrder) {
    return prisma.order.findUnique({
        where : { id: submitOrder.id },
    });
}
/**
 * 체결할 주문 조회
 */
export async function findOrder(prisma, data, tradingType, ) {
    if (tradingType == "sell") {
        if (data.orderType == "market") {
            return prisma.order.findFirst({
                where: {
                    stock_id: data.stockId,
                    trading_type: "buy",
                    status: "n",
                },
                select : {
                    id : true,
                    account_id : true,
                    price : true,
                    number : true,
                    match_number : true
                },
                orderBy: [
                    { price: "desc" },
                    { created_at: "asc" },
                ]
            });
        }
        else if (data.orderType == "limit") {
            return prisma.order.findFirst({
                where: {
                    stock_id: data.stockId,
                    trading_type: "buy",
                    status: "n",
                    price: {
                        gte: data.price,
                    },
                },
                select : {
                    id : true,
                    account_id : true,
                    price : true,
                    number : true,
                    match_number : true
                },
                orderBy: [
                    { price: "desc" },
                    { created_at: "asc" },
                ],
            });
        }
    } else if (tradingType == "buy") {
        if (data.orderType == "market") {
            return prisma.order.findFirst({
                where: {
                    stock_id: data.stockId,
                    trading_type: "sell",
                    status: "n",
                },
                select : {
                    id : true,
                    account_id : true,
                    price : true,
                    number : true,
                    match_number : true
                },
                orderBy: [
                    { price: "asc" },
                    { created_at: "asc" },
                ],
            });
        } else if (data.orderType == "limit") {
            return prisma.order.findFirst({
                where: {
                    stock_id: data.stockId,
                    trading_type: "sell",
                    status: "n",
                    price: {
                        lte: data.price,
                    }
                },
                select : {
                    id : true,
                    account_id : true,
                    price : true,
                    number : true,
                    match_number : true
                },
                orderBy: [
                    { price: "asc" },
                    { created_at: "asc" },
                ],
            });
        }
    }
}

/**
 * 계좌에 있는 돈 증감 / 차감
 */
export async function accountMoneyUpdate() {

}

/**
 * 계좌에 있는 주식 업데이트
 * 
 * 매수시 수량 / 평단가 업데이트 
 * 매도시 수량 업데이트
 * 
 */

/**
 * 경우의 수
 * 
 */
export async function accountStockUpdate(
    prisma: PrismaClient,
    stock_id: number,
    account_id: number,
    number: number,
    type: "increase" | "decrease",
    isFound: boolean,
    buyPrice?: number,
) {
    const userStocks = await prisma.user_stocks.findFirst({
        where : { account_id : account_id, stock_id : stock_id }
    });
    if (type == "increase") {
        if (!userStocks) {
            await prisma.user_stocks.create({
                data : {
                    account_id : account_id,
                    stock_id : stock_id,
                    number : number,
                    can_number : number,
                    average : buyPrice
                }
            })
        }
        else {
            await prisma.user_stocks.update({
                where : { id : userStocks.id },
                   data : {
                    number : userStocks.number + number,
                    can_number : userStocks.can_number + number,
                    average : 
                    ((userStocks.average *  userStocks.number) + (buyPrice * number)) /
                    (userStocks.number + number)
                }
            });
        }
    }
    else if (type == "decrease") {
        if (userStocks.number - number == 0) {
            await prisma.user_stocks.delete({
                where : { id : userStocks.id }
            });
        }
        else if (isFound) {
            await prisma.user_stocks.update({
                where : { id: userStocks.id },
                data : {
                    number : userStocks.number - number
                }
            })
        }
        else {
            await prisma.user_stocks.update({
                where : { id : userStocks.id },
                data : {
                    number : userStocks.number - number,
                    can_number : userStocks.can_number - number
                }
            });
        }
    }
}

/**
 * 체결되고 난뒤 잔여 수량 업데이트
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
 * 주문 상태 업데이트
 * 
 * 배열의 크기는 최소1개 최대 2개
 * 주문이 한가지일 경우에는 number에 업데이트될 수량을 매게변수로 받음
 */
export async function orderCompleteUpdate(prisma, orders: Order[], number?: number) {
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
 * 체결된 가격으로 주식가격 업데이트
 */
export async function stockPriceUpdate(prisma, data, updatePrice) {
    await prisma.stocks.update({
        where : { id : data.stockId },
        data : {
            price : updatePrice
        }
    });
}

/**
 * 체결정보 DB 기록
 */
export async function createOrderMatch(prisma, data, submitOrder, findOrder, numberOfCase) {
    if (numberOfCase == 3) {
        await prisma.order_match.create({
            data: {
                stock_id: data.stockId,
                number: findOrder.number - findOrder.match_number,
                initial_order_id: findOrder.id,
                order_id: submitOrder.id
            }
        });
    } else {
        await prisma.order_match.create({
            data: {
                stock_id: data.stockId,
                number: submitOrder.number - submitOrder.match_number,
                initial_order_id: findOrder.id,
                order_id: submitOrder.id
            }
        });
    }
}