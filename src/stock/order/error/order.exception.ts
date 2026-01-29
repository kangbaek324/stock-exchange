import { HttpException } from '@nestjs/common';
import { OrderError, OrderErrorKey } from './order.error';

export class OrderException extends HttpException {
    constructor(errorKey: OrderErrorKey) {
        const error = OrderError[errorKey];

        super(
            {
                message: error.message,
                errorCode: error.code,
            },
            error.status,
        );
    }
}
