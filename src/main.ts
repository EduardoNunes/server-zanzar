import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://zanzar.netlify.app', // URL do frontend hospedado no Netlify
      null, // Permite requisições de dispositivos móveis (como o APK gerado com o Capacitor)
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(3001);
}

bootstrap();

// http://localhost:3000