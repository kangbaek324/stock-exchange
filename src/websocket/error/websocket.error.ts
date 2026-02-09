export const WebsocketError = {
    ACCOUNT_NOT_FOUND: {
        code: 'WEBSOCKET_001',
        message: '존재하지 않는 계좌 입니다.',
    },
    ACCOUNT_FORBIDDEN: {
        code: 'WEBSOCKET_002',
        message: '접근 권한이 없습니다.',
    },
} as const;

export type WebsocketErrorKey = keyof typeof WebsocketError;