export default () => ({
    DATABASE_URL: process.env.DB_USERNAME,
    SERVER_PORT: process.env.SERVER_PORT,
    WEBSOCKET_PORT: process.env.WEBSOCKET_PORT,
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
});
