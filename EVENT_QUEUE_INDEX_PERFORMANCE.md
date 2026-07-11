# Event Queue Realtime Query Index Performance

## Summary

`event_queue` 소비 중 웹소켓 갱신에서 반복 호출되는 조회 4개를 대상으로 인덱스 적용 전후 `EXPLAIN ANALYZE`를 비교했다.

결과적으로 모든 대상 쿼리에서 실행 시간이 줄었고, 특히 체결 목록 조회는 `ORDER BY matched_at DESC LIMIT 50`을 인덱스로 바로 처리하면서 읽는 row 수가 크게 감소했다.

| Query | Before | After | Improvement |
| --- | ---: | ---: | ---: |
| BUY 호가창 | 15.5 ms | 1.96 ms | 7.9x faster |
| SELL 호가창 | 33.0 ms | 0.721 ms | 45.8x faster |
| 최근 체결 목록 | 32.1 ms | 0.786 ms | 40.8x faster |
| 계좌 미체결 주문 | 7.74 ms | 1.16 ms | 6.7x faster |

> 측정값은 `EXPLAIN ANALYZE`의 `actual time` 기준이다. 단일 실행 결과라 DB 캐시 상태에 따라 절대 시간은 달라질 수 있지만, 실행 계획 변화는 명확하다.

## Indexes Added

```sql
CREATE INDEX `orders_stock_id_status_trading_type_price_idx`
    ON `orders`(`stock_id`, `status`, `trading_type`, `price`);

CREATE INDEX `orders_account_id_status_created_at_idx`
    ON `orders`(`account_id`, `status`, `created_at`);

CREATE INDEX `orders_account_id_created_at_idx`
    ON `orders`(`account_id`, `created_at`);

CREATE INDEX `trades_stock_id_matched_at_idx`
    ON `trades`(`stock_id`, `matched_at`);
```

## Query 1: BUY Order Book

```sql
SELECT price, SUM(quantity - filled_quantity) AS quantity
FROM orders
WHERE stock_id = 1 AND trading_type = 'BUY' AND status = 'OPEN'
GROUP BY trading_type, price
ORDER BY price DESC;
```

### Before

- Plan: `orders_stock_id_fkey`로 `stock_id=1` 전체 조회 후 `trading_type`, `status` 필터링
- Read rows: 29,035
- Matched rows after filter: 1,305
- Extra work: temporary table aggregate + sort
- Actual time: 15.5 ms

### After

- Plan: `orders_stock_id_status_trading_type_price_idx`
- Read rows: 1,305
- Extra work: index order를 활용한 group aggregate
- Actual time: 1.96 ms

### Result

읽는 row가 `29,035 -> 1,305`로 줄었고, 실행 시간은 `15.5 ms -> 1.96 ms`로 약 7.9배 개선됐다.

## Query 2: SELL Order Book

```sql
SELECT price, SUM(quantity - filled_quantity) AS quantity
FROM orders
WHERE stock_id = 1 AND trading_type = 'SELL' AND status = 'OPEN'
GROUP BY trading_type, price
ORDER BY price ASC;
```

### Before

- Plan: `orders_stock_id_fkey`로 `stock_id=1` 전체 조회 후 `trading_type`, `status` 필터링
- Read rows: 29,035
- Matched rows after filter: 872
- Extra work: temporary table aggregate + sort
- Actual time: 33.0 ms

### After

- Plan: `orders_stock_id_status_trading_type_price_idx`
- Read rows: 872
- Extra work: index order를 활용한 group aggregate
- Actual time: 0.721 ms

### Result

읽는 row가 `29,035 -> 872`로 줄었고, 실행 시간은 `33.0 ms -> 0.721 ms`로 약 45.8배 개선됐다.

## Query 3: Recent Trades

```sql
SELECT price, quantity,
       (SELECT trading_type FROM orders o WHERE o.id = t.taker_order_id) AS type
FROM trades t
WHERE stock_id = 1
ORDER BY matched_at DESC
LIMIT 50;
```

### Before

- Plan: `trades_stock_id_fkey`로 `stock_id=1` 전체 조회
- Read rows: 26,420
- Extra work: `matched_at DESC` sort 후 limit
- Actual time: 32.1 ms

### After

- Plan: `trades_stock_id_matched_at_idx`
- Read rows: 50
- Extra work: index reverse scan으로 최신 50건만 조회
- Actual time: 0.786 ms

### Result

읽는 row가 `26,420 -> 50`으로 줄었고, 실행 시간은 `32.1 ms -> 0.786 ms`로 약 40.8배 개선됐다.

이 쿼리는 `ORDER BY matched_at DESC LIMIT 50` 패턴이라 `(stock_id, matched_at)` 인덱스 효과가 가장 직접적으로 나타났다.

## Query 4: Account Open Orders

```sql
SELECT id, stock_id, price, quantity, filled_quantity, order_type, trading_type, status, created_at
FROM orders
WHERE account_id = 1 AND status = 'OPEN'
ORDER BY created_at DESC;
```

### Before

- Plan: `orders_account_id_fkey`로 `account_id=1` 전체 조회 후 `status` 필터링
- Read rows: 11,594
- Matched rows after filter: 1,304
- Extra work: `created_at DESC` sort
- Actual time: 7.74 ms

### After

- Plan: `orders_account_id_status_created_at_idx`
- Read rows: 1,304
- Extra work: index reverse scan으로 정렬 처리
- Actual time: 1.16 ms

### Result

읽는 row가 `11,594 -> 1,304`로 줄었고, 실행 시간은 `7.74 ms -> 1.16 ms`로 약 6.7배 개선됐다.

## Impact On event_queue Bottleneck

기존에는 `event_queue` consumer가 이벤트를 처리할 때 웹소켓 갱신용 DB 조회를 반복 실행했다. 특히 호가창, 체결 목록, 계좌 주문 목록 조회가 많이 발생하면 DB 부하가 커지고 같은 Nest 프로세스의 주문 API까지 지연될 수 있었다.

인덱스 적용 후에는 다음 효과가 있다.

- 호가창 조회가 `stock_id` 전체 주문을 훑지 않고 `stock_id + status + trading_type` 조건으로 바로 좁혀진다.
- 체결 목록 조회가 종목 전체 체결을 정렬하지 않고 최신 50건만 인덱스에서 바로 가져온다.
- 계좌 미체결 조회가 계좌 전체 주문을 훑지 않고 `account_id + status` 조건으로 바로 좁혀진다.
- temporary table, sort, 불필요한 row scan이 줄어 큐 소비 중 DB 점유 시간이 짧아진다.

## Remaining Notes

이 결과는 단일 쿼리 기준이다. 실제 병목은 이벤트 폭주 상황에서 같은 쿼리들이 반복 실행되며 누적되는 것이므로, 최종 확인은 아래 지표를 같이 봐야 한다.

- `event_queue` ready message count
- 주문 API p95/p99 latency
- MySQL CPU, slow query log
- Prisma connection pool wait time
- websocket update frequency

이번 인덱스는 조회 비용을 크게 줄였지만, 이벤트 폭주가 계속 크면 consumer 프로세스와 HTTP 주문 API 프로세스를 분리하는 것이 다음 구조적 개선이다.
