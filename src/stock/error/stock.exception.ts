import { HttpException } from '@nestjs/common';
import { StockError, StockErrorKey } from './stock.error';

export class StockException extends HttpException {
    constructor(errorKey: StockErrorKey) {
        const error = StockError[errorKey];

        super(
            {
                message: error.message,
                errorCode: error.code,
            },
            error.status,
        );
    }
}
