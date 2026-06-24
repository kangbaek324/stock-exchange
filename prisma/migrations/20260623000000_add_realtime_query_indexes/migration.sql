CREATE INDEX `orders_stock_id_status_trading_type_price_idx`
    ON `orders`(`stock_id`, `status`, `trading_type`, `price`);

CREATE INDEX `orders_account_id_status_created_at_idx`
    ON `orders`(`account_id`, `status`, `created_at`);

CREATE INDEX `orders_account_id_created_at_idx`
    ON `orders`(`account_id`, `created_at`);

CREATE INDEX `trades_stock_id_matched_at_idx`
    ON `trades`(`stock_id`, `matched_at`);
