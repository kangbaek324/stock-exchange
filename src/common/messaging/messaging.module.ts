import { Global, Inject, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ClientProxy, ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

// MQ 발행 클라이언트 주입 토큰
export const DATA_SERVICE = 'DATA_SERVICE';
export const ADMIN_SERVICE = 'ADMIN_SERVICE';

const rmqClient = (queue: string) => ({
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => ({
        transport: Transport.RMQ as const,
        options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue,
            queueOptions: {
                durable: true,
            },
            persistent: true,
        },
    }),
});

@Global()
@Module({
    imports: [
        ClientsModule.registerAsync([
            { name: DATA_SERVICE, ...rmqClient('data_queue') },
            { name: ADMIN_SERVICE, ...rmqClient('admin_queue') },
        ]),
    ],
    exports: [ClientsModule],
})
export class MessagingModule implements OnApplicationBootstrap {
    constructor(
        @Inject(DATA_SERVICE) private readonly dataClient: ClientProxy,
        @Inject(ADMIN_SERVICE) private readonly adminClient: ClientProxy,
    ) {}

    // 부팅 시 미리 연결해 큐를 선언해둠
    // (producer는 첫 emit까지 lazy 연결이라, 안 하면 컨슈머가 큐 없음 404를 만남)
    async onApplicationBootstrap() {
        await Promise.all([this.dataClient.connect(), this.adminClient.connect()]);
    }
}
