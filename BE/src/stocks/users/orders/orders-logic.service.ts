import { BadGatewayException, Injectable } from "@nestjs/common";
import { BuyDto } from "./dtos/buy.dto";
import { SellDto } from "./dtos/sell.dto";
import { PrismaClient } from "@prisma/client";
import * as utils from "./utils/orders.util";

/**
 * 주식 매수, 매도 로직
 */
@Injectable()
export class OrdersLogicService {
    async order(
        prisma: PrismaClient, 
        data: BuyDto | SellDto, 
        submitOrder, 
        tradingType
    ): Promise<void> 
    {
        while (true) {
            let findOrder;
            submitOrder = await utils.submitOrder(prisma, submitOrder);
            findOrder = await utils.findOrder(prisma, data, tradingType);
            
            if (findOrder) {
                // 체결 가능한 수량
                const submitOrderNumber = submitOrder.number - submitOrder.match_number;
                const findOrderNumber = findOrder.number - findOrder.match_number;

                if (submitOrderNumber == findOrderNumber) {
                    const order = [findOrder, submitOrder]
                    // 잔고 수정
                    if (tradingType == "buy") {
                        await utils.accountStockUpdate(
                            prisma, 
                            data.stockId, 
                            submitOrder.account_id, 
                            submitOrderNumber, 
                            "increase",
                            false,
                            findOrder.price,
                        );
                        
                        await utils.accountStockUpdate(
                            prisma, 
                            data.stockId, 
                            findOrder.account_id, 
                            submitOrderNumber,
                            "decrease",
                            true
                        );
                    } else {
                        await utils.accountStockUpdate(
                            prisma, 
                            data.stockId, 
                            submitOrder.account_id,
                            submitOrderNumber, 
                            "decrease",
                            false
                        );
                        
                        await utils.accountStockUpdate(
                            prisma, 
                            data.stockId, 
                            findOrder.account_id, 
                            submitOrderNumber, 
                            "increase",
                            false,
                            findOrder.price,
                        );
                    }
                    await utils.orderCompleteUpdate(prisma, order); 
                    // 돈 증감 / 차감 
                    await utils.createOrderMatch(prisma, data, submitOrder, findOrder, 1);
                    await utils.stockPriceUpdate(prisma, data, findOrder.price);
                    return;
                }
                else if (submitOrderNumber < findOrderNumber) {
                    const order = [submitOrder]
                    // 잔고 수정
                    if (tradingType == "buy") {
                        await utils.accountStockUpdate(
                            prisma, 
                            data.stockId, 
                            submitOrder.account_id, 
                            submitOrderNumber, 
                            "increase",
                            false,
                            findOrder.price,
                        );
                        
                        await utils.accountStockUpdate(
                            prisma, 
                            data.stockId, 
                            findOrder.account_id, 
                            submitOrderNumber,
                            "decrease",
                            true
                        );
                    } else {
                        await utils.accountStockUpdate(
                            prisma, 
                            data.stockId, 
                            submitOrder.account_id,
                            submitOrderNumber, 
                            "decrease",
                            false
                        );
                        
                        await utils.accountStockUpdate(
                            prisma, 
                            data.stockId, 
                            findOrder.account_id, 
                            submitOrderNumber, 
                            "increase",
                            false,
                            findOrder.price,
                        );
                    }
                    await utils.orderCompleteUpdate(prisma, order, submitOrder.number);
                    await utils.orderMatchAndRemainderUpdate(prisma, findOrder, submitOrder);
                    // 돈 증감 / 차감
                    await utils.createOrderMatch(prisma, data, submitOrder, findOrder, 2)
                    await utils.stockPriceUpdate(prisma, data, findOrder.price);
                    return;
                }
                else if (submitOrderNumber > findOrderNumber) {
                    const order = [findOrder]
                    // 잔고 수정
                    if (tradingType == "buy") {
                        await utils.accountStockUpdate(
                            prisma, 
                            data.stockId, 
                            submitOrder.account_id, 
                            findOrderNumber, 
                            "increase",
                            false,
                            findOrder.price,
                        );
                        
                        await utils.accountStockUpdate(
                            prisma, 
                            data.stockId, 
                            findOrder.account_id, 
                            findOrderNumber,
                            "decrease",
                            true
                        );
                    } else {
                        await utils.accountStockUpdate(
                            prisma, 
                            data.stockId, 
                            submitOrder.account_id,
                            findOrderNumber, 
                            "decrease",
                            false
                        );
                        
                        await utils.accountStockUpdate(
                            prisma, 
                            data.stockId, 
                            findOrder.account_id, 
                            findOrderNumber, 
                            "increase",
                            false,
                            findOrder.price,
                        );
                    }
                    await utils.orderCompleteUpdate(prisma, order, findOrder.number);
                    await utils.orderMatchAndRemainderUpdate(prisma, submitOrder, findOrder)
                    // 돈 증감 / 차감
                    await utils.createOrderMatch(prisma, data, submitOrder, findOrder, 3)
                    await utils.stockPriceUpdate(prisma, data, findOrder.price);
                }
            } else {
                // 더이상 체결할 주문이 없거나 / 즉시 체결가능한 주문이 없는경우
                // 시장가인데 모두 체결 되지 않은 경우 (현재 가격 지정가로 등록)
                const userStocks = await prisma.user_stocks.findFirst({
                    where : { account_id : submitOrder.account_id, stock_id : data.stockId }
                });
                
                if (tradingType == "sell") {
                    await prisma.user_stocks.update({
                        where : { id : userStocks.id },
                        data : {
                            can_number : userStocks.can_number - (submitOrder.number - submitOrder.match_number) 
                        }
                    });
                }

                if (submitOrder.number != submitOrder.match_number && submitOrder.order_type == "market") {
                    const stockPriceNow = await prisma.stocks.findUnique({
                        where : { id : submitOrder.stock_id },
                        select : { price : true }
                    }); 
                    await prisma.order.update({
                        where : { id : submitOrder.id },
                        data : { price : stockPriceNow.price }
                    });
                }
                return;
            }
        }
    }
}
