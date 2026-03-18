import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { OrderEventedData } from '../type/order-evented-data.type';
import { OrderWsService } from '../service/order-ws.service';
import { StockWsService } from '../service/stock-ws.service';
import { AccountWsService } from '../service/account-ws.service';
import { ChartWsService } from '../service/chart-ws.service';

@Controller()
export class OrderEventConsumer {
    constructor(
        private readonly orderWsService: OrderWsService,
        private readonly accountWsService: AccountWsService,
        private readonly stockWsService: StockWsService,
        private readonly chartWsService: ChartWsService,
    ) {}

    @EventPattern('order.evented')
    async orderEvented(@Payload() mqData: OrderEventedData, @Ctx() context: RmqContext) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        const type = mqData.type;
        const stockId = mqData.stock.id;
        const stockPirce = mqData.stock.nextPrice;
        const matchedAt = mqData.matchedAt;
        const volume = mqData.volume;
        const orders = mqData.updatedOrders;
        const matchedList = mqData.matchedList;

        try {
            await Promise.all([
                this.stockWsService.updateOrderbook(
                    type,
                    stockId,
                    orders,
                    matchedList,
                    mqData.prevOrderPrice,
                ),
                this.stockWsService.updateMatchedList(type, stockId, matchedList),
            ]);

            await Promise.all([
                this.stockWsService.sendOrderBook(stockId),
                mqData.updatedOrders.length >= 2
                    ? Promise.all([
                          this.stockWsService.sendStockInfo(stockId),
                          this.stockWsService.sendMatchedList(stockId),
                          this.chartWsService.updateChart(
                              stockId,
                              stockPirce,
                              volume,
                              matchedAt,
                          ),
                          this.stockWsService.updateStockPrice(stockId, stockPirce),
                      ])
                    : Promise.resolve(),
                ...orders.map((order) =>
                    Promise.all([
                        this.orderWsService.updateOrder(order.accountId, order),
                        this.accountWsService.updateAccount(order.accountId),
                    ]),
                ),
            ]);

            channel.ack(originalMsg);
        } catch (err) {
            console.error(err);
            channel.nack(originalMsg);
        }
    }
}
