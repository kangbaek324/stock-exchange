export type OrderEventedData = {
    stockId: number;
    updatedOrders: { id: number; accountId: number }[];
};
