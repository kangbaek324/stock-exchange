import { Injectable } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { GetRankingDto } from './dto/get-ranking.dto';
import { AssetRankingRow } from './type/asset-ranking.type';

@Injectable()
export class RankingService {
    constructor(private readonly prismaService: PrismaService) {}

    // NOTE: 보유 금액과 보유 주식의 평가 금액을 합산한 값으로 랭킹을 매긴다.
    // 계산시 가능 수량과, 가능 금액이 아닌 보유 금액, 보유 수량으로 계산한다.
    async getAssetRanking({ page, size }: GetRankingDto) {
        const offset = (page - 1) * size;

        const rows = await this.prismaService.$queryRaw<AssetRankingRow[]>`
            SELECT
                -- u.id                                                    AS userId,
                u.username                                              AS username,
                -- CAST(a.balanceSum AS UNSIGNED)                          AS balance,
                -- CAST(COALESCE(h.evalSum, 0) AS UNSIGNED)                AS stockValue,
                CAST(a.balanceSum + COALESCE(h.evalSum, 0) AS UNSIGNED) AS totalAssets
            FROM users u
            JOIN (
                SELECT user_id, SUM(balance) AS balanceSum
                FROM accounts
                WHERE status = ${AccountStatus.ACTIVE}
                AND user_id != 1 -- BOT 계정 제외
                GROUP BY user_id
            ) a ON a.user_id = u.id
            LEFT JOIN (
                SELECT acc.user_id, SUM(us.quantity * s.price) AS evalSum
                FROM user_stocks us
                JOIN accounts acc ON acc.id = us.account_id
                                 AND acc.status = ${AccountStatus.ACTIVE}
                JOIN stocks s ON s.id = us.stock_id
                GROUP BY acc.user_id
            ) h ON h.user_id = u.id
            ORDER BY totalAssets DESC, u.id ASC
            LIMIT ${size + 1} OFFSET ${offset}
        `;

        const hasMore = rows.length > size;
        const rankings = rows.slice(0, size).map((row, index) => ({
            rank: offset + index + 1,
            // userId: row.userId,
            username: row.username,
            // balance: row.balance.toString(),
            // stockValue: row.stockValue.toString(),
            totalAssets: row.totalAssets.toString(),
        }));

        return { rankings, page, size, hasMore };
    }
}
