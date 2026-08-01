export const RedisKeys = {
    stock: (stockId: number): string => `rt:stock:${stockId}`,
    account: (accountId: number): string => `rt:account:${accountId}`,
    holding: (accountId: number, stockId: number): string =>
        `rt:holding:${accountId}:${stockId}`,
    order: (orderId: bigint | string): string => `rt:order:${orderId}`,
} as const;
