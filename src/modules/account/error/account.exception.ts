import { HttpException } from '@nestjs/common';
import {
    AccountAdminError,
    AccountAdminErrorKey,
    AccountError,
    AccountErrorKey,
} from './account.error';

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

export class AccountAdminException extends HttpException {
    constructor(errorKey: AccountAdminErrorKey) {
        const error = AccountAdminError[errorKey];

        super(
            {
                message: error.message,
                errorCode: error.code,
            },
            error.status,
        );
    }
}
