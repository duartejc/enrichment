import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { EnrichmentProcessor } from '../processors/enrichment.processor';
import { OpenCNPJService } from '../services/opencnpj.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'enrichment',
    }),
  ],
  providers: [EnrichmentProcessor, OpenCNPJService],
  exports: [BullModule, OpenCNPJService],
})
export class AppBullModule {}
