import { Module } from '@nestjs/common';
import { InfoController } from './info.controller';
import { InfoService } from './info.service';

@Module({
  controllers: [InfoController],
  providers: [InfoService]
})
export class InfoModule {}
