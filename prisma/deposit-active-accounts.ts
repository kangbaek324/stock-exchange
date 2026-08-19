import { NestFactory } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { ADMIN_SERVICE } from 'src/common/messaging/messaging.module';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AppModule } from '../src/app.module';

const DEPOSIT_AMOUNT = '1000000'; // 100만원

async function main() {
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
    });

    const prismaService = app.get(PrismaService);
    const adminClient = app.get<ClientProxy>(ADMIN_SERVICE);

    const accounts = await prismaService.account.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
    });

    console.log(`ACTIVE 계좌 ${accounts.length}건에 ${DEPOSIT_AMOUNT}원씩 입금`);

    const baseId = BigInt(Date.now()) * 1000n;

    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        await lastValueFrom(
            adminClient.emit('admin.balance.adjust', {
                id: (baseId + BigInt(i)).toString(),
                accountId: account.id.toString(),
                delta: DEPOSIT_AMOUNT,
            }),
        );
        console.log(`    완료: accountId=${account.id} delta=${DEPOSIT_AMOUNT}`);
    }

    await app.close();
    console.log('입금 완료');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
