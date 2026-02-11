import { HttpStatus } from '@nestjs/common';

export const ChartError = {
    NOT_SUPPORT_TYPE: {
        code: 'CHART_001',
        status: HttpStatus.NOT_FOUND,
        message: '지원하지 않는 봉입니다.',
    },
} as const;

export type ChartErrorKey = keyof typeof ChartError;
