import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const WRITE_RETRY_DEFAULTS = {
  count: 3,
  baseDelayMs: 30,
};

interface PrismaWriteRetryOptions {
  count?: number;
  baseDelayMs?: number;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
  }

  async retryWrite<T>(
    operation: () => Promise<T>,
    options: PrismaWriteRetryOptions = {},
  ): Promise<T> {
    const count = options.count ?? WRITE_RETRY_DEFAULTS.count;
    const baseDelayMs = options.baseDelayMs ?? WRITE_RETRY_DEFAULTS.baseDelayMs;

    for (let attempt = 0; ; attempt++) {
      try {
        return await operation();
      } catch (err) {
        if (!this.isWriteConflict(err) || attempt >= count) {
          throw err;
        }

        const delayMs = baseDelayMs * 2 ** attempt;
        this.logger.warn(
          `DB write conflict detected. retry=${attempt + 1}/${count}`,
        );
        await this.sleep(delayMs);
      }
    }
  }

  private isWriteConflict(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      err.code === 'P2034'
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
