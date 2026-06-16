import { HttpException } from '@nestjs/common';
import { ChartError, ChartErrorKey } from './chart.error';

export class ChartException extends HttpException {
    constructor(errorKey: ChartErrorKey) {
        const error = ChartError[errorKey];

        super(
            {
                message: error.message,
                errorCode: error.code,
            },
            error.status,
        );
    }
}
