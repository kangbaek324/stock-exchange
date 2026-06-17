import { HttpException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as cookieParser from 'cookie-parser';
import { SuccessResponseInterceptor } from './common/interceptors/success-response.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ConfigService } from '@nestjs/config';
import { EventBatchDeserializer } from './modules/websocket/serializer/event-batch.deserializer';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.use(cookieParser());
    app.enableCors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: (errors) => {
                const message = errors
                    .map((error) => Object.values(error.constraints))
                    .flat()
                    .join(', ');

                throw new HttpException(
                    {
                        errorCode: 'VALIDATION_ERROR',
                        message,
                    },
                    HttpStatus.BAD_REQUEST,
                );
            },
        }),
    );

    const configService = app.get(ConfigService);

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: 'event_queue',
            queueOptions: {
                durable: true,
            },
            prefetchCount: 1,
            noAck: false,
            deserializer: new EventBatchDeserializer(),
        },
    });

    const config = new DocumentBuilder()
        .setTitle('orderbook')
        .setDescription('주식 거래소 구현 프로젝트')
        .setVersion('1.0')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                name: 'JWT',
                in: 'header',
            },
            'access-token',
        )
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    app.startAllMicroservices();
    app.useGlobalInterceptors(new SuccessResponseInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());

    app.setGlobalPrefix('api');
    await app.listen(parseInt(process.env.SERVER_PORT), '0.0.0.0');
}
bootstrap();
