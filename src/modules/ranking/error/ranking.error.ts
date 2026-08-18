import { HttpStatus } from '@nestjs/common';

export const RankingError = {
    NOT_SUPPORT_TYPE: {
        code: 'RANKING_001',
        status: HttpStatus.BAD_REQUEST,
        message: '지원하지 않는 랭킹 종류입니다.',
    },
} as const;

export type RankingErrorKey = keyof typeof RankingError;
