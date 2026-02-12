export default () => ({
    DATABASE_URL: process.env.DB_USERNAME,
    SERVER_PORT: process.env.SERVER_PORT,
    WEBSOCKET_PORT: process.env.WEBSOCKET_PORT,
    JWT_SECRET: process.env.JWT_SECRET,
});
