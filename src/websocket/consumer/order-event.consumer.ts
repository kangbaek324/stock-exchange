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
            // 주식 업데이트
            this.stockWsService.updateStock(mqData.stockId);
            await this.stockWsService.updateStockPrice(mqData.stockId);

            // 차트 업데이트
            if (mqData.updatedOrders.length >= 2) {
                await this.chartWsService.updateChart(mqData.stockId);
            }

            // 주문 업데이트
            for (let i = 0; i < mqData.updatedOrders.length; i++) {
                const order = mqData.updatedOrders[i];
                await this.orderWsService.updateOrder(order.accountId, order.id);
                await this.accountWsService.updateAccount(order.accountId);
            }
        } catch (err) {
            console.error(err);
        } finally {
            channel.ack(originalMsg);
        }
    }
}
