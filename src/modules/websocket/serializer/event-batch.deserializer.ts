import { Deserializer, IncomingEvent } from '@nestjs/microservices';
import { EventBatch } from '../type/event.type';

export const EVENT_BATCH_PATTERN = 'event.batch';

export class EventBatchDeserializer implements Deserializer<unknown, IncomingEvent> {
    deserialize(value: unknown): IncomingEvent {
        const batch = value as EventBatch;

        return {
            pattern: EVENT_BATCH_PATTERN,
            data: batch,
        };
    }
}
