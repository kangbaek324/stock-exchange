import { PrismaClient } from "@prisma/client";
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

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
export async function findOrder(prisma, data, tradingType) {
    const stockId = data.stockId;
    const orderType = data.orderType;
    const price = data.price;

    let sql = `
        SELECT id, account_id, price, number, match_number
        FROM \`order\`
        WHERE stock_id = ? AND trading_type = ? AND status = 'n'
    `;

    const params = [stockId];

    if (tradingType === "sell") {
        params.push("buy");
        if (orderType === "limit") {
            sql += ` AND price >= ?`;
            params.push(price);
        }
        sql += ` ORDER BY price DESC, created_at ASC LIMIT 1 FOR UPDATE`;
    } 
    else if (tradingType === "buy") {
        params.push("sell");
        if (orderType === "limit") {
            sql += ` AND price <= ?`;
            params.push(price);
        }
        sql += ` ORDER BY price ASC, created_at ASC LIMIT 1 FOR UPDATE`;
    }

    const [order] = await prisma.$queryRawUnsafe(sql, ...params);
    return order ?? null;
}  


/**
 * 계좌 업데이트
 * 
 * 보유 수량, 돈 
 * 
 */
export async function accountUpdate(
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
                    account_id: account_id,
                    stock_id: stock_id,
                    number: BigInt(number),
                    can_number: BigInt(number),
                    average: buyPrice, 
                    total_buy_amount: BigInt(buyPrice) * BigInt(number)
                }
            });
        }
        else {
            await prisma.user_stocks.update({
                where : { id : userStocks.id },
                   data : {
                    number : userStocks.number + BigInt(number),
                    can_number : userStocks.can_number + BigInt(number),
                    average: Number(
                    ((BigInt(userStocks.average) * userStocks.number) +
                    (BigInt(buyPrice) * BigInt(number)))
                    / (userStocks.number + BigInt(number))
                    ),
                    total_buy_amount: userStocks.total_buy_amount + BigInt(buyPrice) * BigInt(number)
                }
            });
        }
    }
    else if (type == "decrease") {
        if (userStocks.number - BigInt(number) == BigInt(0)) {
            await prisma.user_stocks.delete({
                where : { id : userStocks.id }
            });
        }
        else if (isFound) {
            await prisma.user_stocks.update({
                where : { id: userStocks.id },
                data : {
                    number : userStocks.number - BigInt(number),
                    total_buy_amount: userStocks.total_buy_amount - BigInt(userStocks.average) * BigInt(number)
                }
            })
        }
        else {
            await prisma.user_stocks.update({
                where : { id : userStocks.id },
                data : {
                    number : userStocks.number - BigInt(number),
                    can_number : userStocks.can_number - BigInt(number),
                    total_buy_amount: userStocks.total_buy_amount - BigInt(userStocks.average) * BigInt(number)
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
export async function orderCompleteUpdate(prisma, orders, number?: number) {
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
                close: updatePrice
            }
        })
    }
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