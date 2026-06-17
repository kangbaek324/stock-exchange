import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { EVENT_BATCH_PATTERN } from '../serializer/event-batch.deserializer';
import { DomainEvent, EventBatch } from '../type/event.type';

@Controller()
export class EventConsumer {
    private readonly logger = new Logger(EventConsumer.name);

    @EventPattern(EVENT_BATCH_PATTERN)
    async handleEventBatch(@Payload() batch: EventBatch, @Ctx() context: RmqContext) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        try {
            for (const event of batch.events) {
                await this.dispatch(event);
            }

            channel.ack(originalMsg);
        } catch (err) {
            this.logger.error(
                `이벤트 배치 처리 실패 (inputSeq=${batch?.inputSeq})`,
                err instanceof Error ? err.stack : err,
            );
            channel.nack(originalMsg, false, false);
        }
    }

    private async dispatch(event: DomainEvent): Promise<void> {
        switch (event.pattern) {
            case 'trade.executed':
                return;
            case 'order.open':
                return;
            case 'order.filled':
                return;
            case 'order.canceled':
                return;
            case 'order.rejected':
                return;
            case 'account.updated':
                return;
            case 'account.activated':
                return;
            case 'holding.updated':
                return;
            case 'stock.listed':
                return;
            default: {
                const _exhaustive: never = event;
                this.logger.warn(`알 수 없는 이벤트: ${JSON.stringify(_exhaustive)}`);
            }
        }
    }
}
