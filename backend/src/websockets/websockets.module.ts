import { Module } from '@nestjs/common';
import { DataGateway } from './data.gateway';
import { DataEnrichmentService } from '../services/data-enrichment.service';
import { SheetService } from '../services/sheet.service';
import { CollaborationService } from '../services/collaboration.service';
import { AppBullModule } from '../bull/bull.module';

@Module({
  imports: [AppBullModule],
  providers: [
    DataGateway, 
    DataEnrichmentService, 
    SheetService, 
    CollaborationService
  ],
  exports: [
    DataGateway, 
    DataEnrichmentService, 
    SheetService, 
    CollaborationService
  ],
})
export class WebsocketsModule {}
