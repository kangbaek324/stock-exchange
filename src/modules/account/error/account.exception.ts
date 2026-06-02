import { HttpException } from '@nestjs/common';
import { AccountError, AccountErrorKey } from './account.error';

export class AccountException extends HttpException {
    constructor(errorKey: AccountErrorKey) {
        const error = AccountError[errorKey];

        super(
            {
                message: error.message,
                errorCode: error.code,
            },
            error.status,
        );
    }
}
