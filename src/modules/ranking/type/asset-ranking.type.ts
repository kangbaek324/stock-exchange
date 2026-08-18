export type AssetRankingRow = {
    // userId: number;
    username: string;
    // balance: bigint; // 계좌 예수금 합
    // stockValue: bigint; // 보유 주식 평가금액 합
    totalAssets: bigint; // balance + stockValue
};
