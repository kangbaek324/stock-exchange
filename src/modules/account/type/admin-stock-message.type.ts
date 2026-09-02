export type AdminStockAdjustMessage = {
    id: string;
    accountId: string;
    stockId: string;
    delta: string; // 부호 있는 증감 수량. 출고는 음수
    average: string; // 최초 보유 생성 시 평균 단가
};
