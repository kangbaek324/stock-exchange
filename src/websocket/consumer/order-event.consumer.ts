import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { OrderEventedData } from '../type/order-evented-data.type';

@Controller()
export class OrderEventConsumer {
    @EventPattern('order.evented')
    async orderEvented(@Payload() mqData: OrderEventedData, @Ctx() context: RmqContext) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        try {
            console.log(mqData);
        } catch (err) {
            console.error(err);
        } finally {
            channel.ack(originalMsg);
        }
    }
}
