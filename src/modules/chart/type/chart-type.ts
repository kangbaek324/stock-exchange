import { CandleType } from '@prisma/client';

export type ChartType = '1m' | '5m' | '15m' | '30m' | '1h' | '1d';
export const CHART_TYPES: ChartType[] = ['1m', '5m', '15m', '30m', '1h', '1d'];

export const CANDLE_TYPE: Record<ChartType, CandleType> = {
    '1m': CandleType.ONE_MINUTE,
    '5m': CandleType.FIVE_MINUTES,
    '15m': CandleType.FIFTEEN_MINUTES,
    '30m': CandleType.THIRTY_MINUTES,
    '1h': CandleType.ONE_HOUR,
    '1d': CandleType.ONE_DAY,
};
