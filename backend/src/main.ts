import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://56.124.127.185'],
    credentials: true,
  });
  
  await app.listen(3002);
  console.log('🚀 Backend running on http://localhost:3002');
}
bootstrap();
