import { Injectable } from "@nestjs/common";
import { BuyDto } from "./dtos/buy.dto";
import { SellDto } from "./dtos/sell.dto";

@Injectable()
export class OrderService {
    async order(prisma, data: BuyDto | SellDto, submitOrder, tradingType): Promise<void> {
        while (true) {
            submitOrder = await prisma.order.findUnique({
                where : { id: submitOrder.id },
                select : { 
                    id : true,
                    stock_id : true,
                    number : true,
                    order_type : true,
                    match_number : true,
                }
            });

            let findOrder;
            if (tradingType == "sell") {
                if (data.orderType == "market") {
                    findOrder = await prisma.order.findFirst({
                        where: {
                            stock_id: data.stockId,
                            trading_type: "buy",
                            status: "n",
                        },
                        select : {
                            id : true,
                            price : true,
                            number : true,
                            match_number : true
                        },
                        orderBy: [
                            { price: "desc" },
                            { created_at: "asc" },
                        ]
                    });
                } else if (data.orderType == "limit") {
                    findOrder = await prisma.order.findFirst({
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
            } else {
                if (data.orderType == "market") {
                    findOrder = await prisma.order.findFirst({
                        where: {
                        stock_id: data.stockId,
                        trading_type: "sell",
                        status: "n",
                        },
                        select : {
                            id : true,
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
                    findOrder = await prisma.order.findFirst({
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

            if (findOrder) {
                if (submitOrder.number - submitOrder.match_number == findOrder.number - findOrder.match_number) {
                    await prisma.order.update({
                        where: {
                            id: submitOrder.id
                        },
                        data: {
                            status: "y",
                            match_number: submitOrder.number
                        }
                    });
                
                    await prisma.order.update({
                        where: {
                            id: findOrder.id
                        },
                        data: {
                            status: "y",
                            match_number: findOrder.number
                        }
                    });
                
                    await prisma.order_match.create({
                        data: {
                            stock_id: data.stockId,
                            number: submitOrder.number - submitOrder.match_number,
                            initial_order_id: findOrder.id,
                            order_id: submitOrder.id
                        }
                    });

                    await prisma.stocks.update({
                        where : { id : data.stockId },
                        data : {
                            price : findOrder.price
                        }
                    });

                    return;
                } else if (submitOrder.number - submitOrder.match_number < findOrder.number - findOrder.match_number) {
                    await prisma.order.update({
                        where: {
                            id: submitOrder.id
                        },
                        data: {
                            status: "y",
                            match_number: submitOrder.number
                        }
                    });
                
                    await prisma.order.update({
                        where: {
                            id: findOrder.id
                        },
                        data: {
                            match_number: findOrder.match_number + (submitOrder.number - submitOrder.match_number)
                        }
                    });
                
                    await prisma.order_match.create({
                        data: {
                            stock_id: data.stockId,
                            number: submitOrder.number - submitOrder.match_number,
                            initial_order_id: findOrder.id,
                            order_id: submitOrder.id
                        }
                    });

                    await prisma.stocks.update({
                        where : { id : data.stockId },
                        data : {
                            price : findOrder.price
                        }
                    });

                    return;
                } else if (submitOrder.number - submitOrder.match_number > findOrder.number - findOrder.match_number) {
                    await prisma.order.update({
                        where: {
                            id: submitOrder.id
                        },
                        data: {
                            match_number: submitOrder.match_number + (findOrder.number - findOrder.match_number)
                        }
                    });
                
                    await prisma.order.update({
                        where: {
                            id: findOrder.id
                        },
                        data: {
                            status: "y",
                            match_number: findOrder.number
                        }
                    });
                
                    await prisma.order_match.create({
                        data: {
                            stock_id: data.stockId,
                            number: findOrder.number - findOrder.match_number,
                            initial_order_id: findOrder.id,
                            order_id: submitOrder.id
                        }
                    });

                    await prisma.stocks.update({
                        where : { id : data.stockId },
                        data : {
                            price : findOrder.price
                        }
                    });
                }
            } else {
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