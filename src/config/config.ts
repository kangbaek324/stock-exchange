export default () => ({
    DATABASE_URL: process.env.DATABASE_URL,
    SERVER_PORT: process.env.SERVER_PORT,
    WEBSOCKET_PORT: process.env.WEBSOCKET_PORT,
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
    REDIS_URL: process.env.REDIS_URL,
    RABBITMQ_URL: process.env.RABBITMQ_URL,
});
