import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

// NOTE: Redis 조회에 실패한 경우, Redis 조회에 성공했지만 값이 없을 경우에는 Null을 반환합니다.
@Injectable()
export class RedisCacheService {
    private readonly logger = new Logger(RedisCacheService.name);

    constructor(@InjectRedis() private readonly redis: Redis) {}

    // 해시 단일 필드 조회
    async getField(key: string, field: string): Promise<string | null> {
        try {
            return await this.redis.hget(key, field);
        } catch (error) {
            this.logger.warn(
                `Failed to read Redis hash field (key=${key}, field=${field})`,
                error instanceof Error ? error.stack : error,
            );
            return null;
        }
    }

    // 해시 필드 조회
    async getFields<F extends string>(
        key: string,
        fields: readonly F[],
    ): Promise<Record<F, string | null>> {
        let values: (string | null)[];
        try {
            values = await this.redis.hmget(key, ...fields);
        } catch (error) {
            this.logger.warn(
                `Failed to read Redis hash fields (key=${key}, fields=${fields.join(',')})`,
                error instanceof Error ? error.stack : error,
            );
            values = fields.map(() => null);
        }

        return fields.reduce(
            (acc, field, i) => {
                acc[field] = values[i] ?? null;
                return acc;
            },
            {} as Record<F, string | null>,
        );
    }

    // 해시 전체 조회
    async getAll(key: string): Promise<Record<string, string> | null> {
        try {
            return await this.redis.hgetall(key);
        } catch (error) {
            this.logger.warn(
                `Failed to read Redis hash (key=${key})`,
                error instanceof Error ? error.stack : error,
            );
            return null;
        }
    }
}
