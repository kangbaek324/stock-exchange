export default () => ({
    DATABASE_URL: process.env.DATABASE_URL,
    SERVER_PORT: process.env.SERVER_PORT,
    WEBSOCKET_PORT: process.env.WEBSOCKET_PORT,
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    RABBITMQ_URL: process.env.RABBITMQ_URL,
});
