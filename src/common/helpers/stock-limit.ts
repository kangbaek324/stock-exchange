import { STOCK_LIMIT } from 'src/common/consants/stock.constants';

export function getTickSize(price: number): number {
    if (price < 2000) return 1;
    if (price < 5000) return 5;
    if (price < 20000) return 10;
    if (price < 50000) return 50;
    if (price < 200000) return 100;
    if (price < 500000) return 500;
    return 1000;
}

export function calcStockLimit(prevClose: number) {
    const upperRaw = Math.floor(prevClose * (1 + STOCK_LIMIT.UPPER_RATE));
    const lowerRaw = Math.ceil(prevClose * (1 - STOCK_LIMIT.LOWER_RATE));

    return {
        upperLimit: Math.floor(upperRaw / getTickSize(upperRaw)) * getTickSize(upperRaw),
        lowerLimit: Math.ceil(lowerRaw / getTickSize(lowerRaw)) * getTickSize(lowerRaw),
    };
}
