import { HttpException } from '@nestjs/common';
import { RankingError, RankingErrorKey } from './ranking.error';

export class RankingException extends HttpException {
    constructor(errorKey: RankingErrorKey) {
        const error = RankingError[errorKey];

        super(
            {
                message: error.message,
                errorCode: error.code,
            },
            error.status,
        );
    }
}
