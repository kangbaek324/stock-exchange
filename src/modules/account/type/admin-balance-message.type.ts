export type AdminBalanceAdjustMessage = {
    id: string; // AdminRequest.id (BigInt → string)
    accountId: string; // Account.id
    delta: string; // 부호 있는 증감액. 출금은 음수
};
