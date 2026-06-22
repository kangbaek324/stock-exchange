import { NestFactory } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import { lastValueFrom } from 'rxjs';
import { ADMIN_SERVICE } from 'src/common/messaging/messaging.module';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AccountService } from 'src/modules/account/account.service';
import { StockService } from 'src/modules/stock/stock.service';
import { AppModule } from '../src/app.module';

interface AccountResult {
    id: number;
    accountNumber: number;
    balance: string;
}

const SEED_PASSWORD = 'password1234';
const SEED_USERS = [
    { username: 'seed_user1', email: 'seed_user1@example.com' },
    { username: 'seed_user2', email: 'seed_user2@example.com' },
];

async function seed() {
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
    });

    const stockService = app.get(StockService);
    const accountService = app.get(AccountService);
    const prismaService = app.get(PrismaService);
    const adminClient = app.get<ClientProxy>(ADMIN_SERVICE);

    // 1. 주식 상장
    console.log('[1] 주식 상장');
    let createdStock = false;
    try {
        await stockService.createStock({ name: 'Nest Software', listingPrice: 10000 });
        createdStock = true;
        console.log('    완료: Nest Software (상장가 10,000)');
    } catch {
        console.log('    건너뜀: 이미 존재하는 주식');
    }

    // 2. 유저 생성 및 계좌 개설
    console.log('[2] 계좌 개설');
    const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);
    const accounts: AccountResult[] = [];
    let createdAccountCount = 0;

    for (const userData of SEED_USERS) {
        let user = await prismaService.user.findUnique({
            where: { username: userData.username },
        });

        if (!user) {
            user = await prismaService.user.create({
                data: {
                    username: userData.username,
                    password: hashedPassword,
                    email: userData.email,
                },
            });
        }

        const existing = await prismaService.account.findFirst({
            where: { userId: user.id },
            select: { id: true, accountNumber: true, balance: true },
        });

        if (existing) {
            accounts.push({ ...existing, balance: existing.balance.toString() });
            console.log(
                `    건너뜀: ${userData.username} 계좌 이미 존재 (accountId=${existing.id})`,
            );
        } else {
            const result = (await accountService.createAccount(user)) as AccountResult;
            accounts.push(result);
            createdAccountCount++;
            console.log(`    완료: ${userData.username} (accountId=${result.id})`);
        }
    }

    const shouldAdjustSeedBalances =
        createdStock && createdAccountCount === SEED_USERS.length;

    // 3. 잔액 추가 (admin.balance.adjust)
    console.log('[3] 잔액 추가');
    if (shouldAdjustSeedBalances) {
        for (let i = 0; i < accounts.length; i++) {
            await lastValueFrom(
                adminClient.emit('admin.balance.adjust', {
                    id: (i + 1).toString(),
                    accountId: accounts[i].id.toString(),
                    delta: '1000000000000000',
                }),
            );
            console.log(
                `    완료: accountId=${accounts[i].id} delta=1,000,000,000,000,000`,
            );
        }
    } else {
        console.log('    건너뜀: 주식 상장 또는 계좌 개설 단계가 건너뜀');
    }

    // 4. 두 번째 계좌에 1번 주식 추가 (admin.stock_balance.adjust)
    console.log('[4] 주식 잔고 추가');
    if (shouldAdjustSeedBalances && accounts[1]) {
        await lastValueFrom(
            adminClient.emit('admin.stock_balance.adjust', {
                id: '4',
                accountId: accounts[1].id.toString(),
                stockId: '1',
                delta: '1000000000000000',
                average: '10000',
            }),
        );
        console.log(`    완료: accountId=${accounts[1].id} stockId=1 delta=1,000,000`);
    } else {
        console.log('    건너뜀: 주식 상장 또는 계좌 개설 단계가 건너뜀');
    }

    await app.close();
    console.log('\n시드 데이터 설정 완료');
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
