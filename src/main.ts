import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://zanzar.netlify.app', // URL do frontend hospedado no Netlify
      'capacitor://localhost', // Para o emulador do Capacitor
      'http://localhost:3000', // Caso esteja rodando localmente o frontend
      'https://server-zanzar.onrender.com', // Caso esteja rodando na produção, coloque o domínio aqui
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(3001);
}

bootstrap();
