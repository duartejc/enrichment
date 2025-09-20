import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebsocketsModule } from './websockets/websockets.module';
import { SheetController } from './controllers/sheet.controller';

@Module({
  imports: [WebsocketsModule],
  controllers: [AppController, SheetController],
  providers: [AppService],
})
export class AppModule {}
