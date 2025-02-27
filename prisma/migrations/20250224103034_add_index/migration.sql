-- CreateIndex
CREATE INDEX `order_stock_id_trading_type_status_price_created_at_idx` ON `order`(`stock_id`, `trading_type`, `status`, `price`, `created_at`);
