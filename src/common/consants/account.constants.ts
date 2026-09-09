export const ACCOUNT_AMOUNT_LIMIT = {
    MAX_BALANCE: 1_000_000_000_000, // 잔고 1회 입·출금/송금 한도 (1조)
    MAX_STOCK: 100_000_000_000,     // 보유 주식 1회 입·출고 한도 (1천억 주)
} as const;
