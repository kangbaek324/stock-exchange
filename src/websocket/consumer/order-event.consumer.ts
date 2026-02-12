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

        try {
            await Promise.all([
                this.stockWsService.updateStock(mqData.stockId),
                this.stockWsService.updateStockPrice(mqData.stockId),
                mqData.updatedOrders.length >= 2
                    ? this.chartWsService.updateChart(mqData.stockId)
                    : Promise.resolve(),
                ...mqData.updatedOrders.map((order) =>
                    Promise.all([
                        this.orderWsService.updateOrder(order.accountId, order.id),
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
