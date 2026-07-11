import { randomBytes } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { AppModule } from '../src/app.module';
import { ADMIN_SERVICE } from '../src/common/messaging/messaging.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

const MAX_ACCOUNT_OR_STOCK_ID = 2_147_483_647;
const MAX_SIGNED_BIGINT = 9_223_372_036_854_775_807n;
const MAX_UNSIGNED_BIGINT = 18_446_744_073_709_551_615n;

interface GrantStockArgs {
    stockId: number;
    accountId: number;
    quantity: bigint;
}

class ArgumentError extends Error {}

function usage(): string {
    return [
        '사용법: npm run prisma:grant-stock -- <stockId> <accountId> <quantity>',
        '예시: npm run prisma:grant-stock -- 1 2 1000000',
    ].join('\n');
}

function parseId(value: string | undefined, name: string): number {
    if (!value || !/^[1-9]\d*$/.test(value)) {
        throw new ArgumentError(`${name}는 1 이상의 정수여야 합니다.`);
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed > MAX_ACCOUNT_OR_STOCK_ID) {
        throw new ArgumentError(
            `${name}는 ${MAX_ACCOUNT_OR_STOCK_ID} 이하의 정수여야 합니다.`,
        );
    }

    return parsed;
}

function parseQuantity(value: string | undefined): bigint {
    if (!value || !/^[1-9]\d*$/.test(value)) {
        throw new ArgumentError('quantity는 1 이상의 정수여야 합니다.');
    }

    const quantity = BigInt(value);
    if (quantity > MAX_SIGNED_BIGINT) {
        throw new ArgumentError(
            `quantity는 ${MAX_SIGNED_BIGINT.toString()} 이하여야 합니다.`,
        );
    }

    return quantity;
}

function parseArgs(): GrantStockArgs {
    const args = process.argv.slice(2);
    if (args.length !== 3) {
        throw new ArgumentError('stockId, accountId, quantity를 모두 입력해야 합니다.');
    }

    return {
        stockId: parseId(args[0], 'stockId'),
        accountId: parseId(args[1], 'accountId'),
        quantity: parseQuantity(args[2]),
    };
}

function createCommandId(): string {
    const id = randomBytes(8).readBigUInt64BE() & MAX_SIGNED_BIGINT;
    return (id === 0n ? 1n : id).toString();
}

async function grantStock() {
    const { stockId, accountId, quantity } = parseArgs();
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
    });

    try {
        const prismaService = app.get(PrismaService);
        const adminClient = app.get<ClientProxy>(ADMIN_SERVICE);

        const [account, stock, holding] = await Promise.all([
            prismaService.account.findUnique({
                where: { id: accountId },
                select: { id: true, status: true },
            }),
            prismaService.stock.findUnique({
                where: { id: stockId },
                select: { id: true, price: true, status: true },
            }),
            prismaService.userStock.findUnique({
                where: {
                    accountId_stockId: { accountId, stockId },
                },
                select: {
                    quantity: true,
                    availableQuantity: true,
                    average: true,
                    totalBuyAmount: true,
                },
            }),
        ]);

        if (!account) {
            throw new Error(`accountId=${accountId} 계좌를 찾을 수 없습니다.`);
        }

        if (account.status !== 'ACTIVE') {
            throw new Error(`accountId=${accountId} 계좌가 아직 활성화되지 않았습니다.`);
        }

        if (!stock) {
            throw new Error(`stockId=${stockId} 주식을 찾을 수 없습니다.`);
        }

        if (stock.status !== 'LISTED') {
            throw new Error(`stockId=${stockId} 주식이 상장 상태가 아닙니다.`);
        }

        const average = holding?.average ?? stock.price;

        if (!holding && average === 0n) {
            throw new Error(
                `stockId=${stockId}의 현재 가격이 0이어서 평균 단가를 설정할 수 없습니다.`,
            );
        }

        if (holding) {
            const additionalBuyAmount = quantity * average;
            if (
                quantity > MAX_UNSIGNED_BIGINT - holding.quantity ||
                quantity > MAX_UNSIGNED_BIGINT - holding.availableQuantity ||
                additionalBuyAmount > MAX_UNSIGNED_BIGINT - holding.totalBuyAmount
            ) {
                throw new Error(
                    '지급 후 보유 수량 또는 매수 금액이 허용 범위를 초과합니다.',
                );
            }
        } else if (quantity > MAX_UNSIGNED_BIGINT / average) {
            throw new Error('지급 후 매수 금액이 허용 범위를 초과합니다.');
        }

        const commandId = createCommandId();

        await lastValueFrom(
            adminClient.emit('admin.stock_balance.adjust', {
                id: commandId,
                accountId: account.id.toString(),
                stockId: stock.id.toString(),
                delta: quantity.toString(),
                average: average.toString(),
            }),
        );

        console.log(
            `MQ 발행 완료: id=${commandId} accountId=${account.id} stockId=${stock.id} delta=${quantity.toString()} average=${average.toString()}`,
        );
    } finally {
        await app.close();
    }
}

grantStock().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    if (err instanceof ArgumentError) {
        console.error(usage());
    }
    process.exit(1);
});
