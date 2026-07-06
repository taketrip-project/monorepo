import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { paraErroDeValidacao } from './common/validation.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // Formato único de erro da API (codigo `validacao`) em vez do 400
      // default do Nest — ver docs/api/*.yaml, resposta ErroValidacao.
      exceptionFactory: paraErroDeValidacao,
    }),
  );
  app.enableCors();

  const port = process.env.PORT ? Number(process.env.PORT) : 3333;
  await app.listen(port);
  console.log(`Taketrip API rodando em http://localhost:${port}`);
}

bootstrap();
