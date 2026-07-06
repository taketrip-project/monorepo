import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DbModule } from './db/db.module';
import { IdentityModule } from './modules/identity/identity.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { ExcursionsModule } from './modules/excursions/excursions.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { BillingModule } from './modules/billing/billing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    // O .env vive na raiz do monorepo (um único arquivo para api + web);
    // scripts rodados via `npm run -w apps/api` têm cwd em apps/api, então
    // o caminho relativo sobe dois níveis. `.env` local também é aceito
    // (ex.: execução direta de dentro de apps/api).
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    DbModule,
    IdentityModule,
    FleetModule,
    ExcursionsModule,
    BookingsModule,
    BillingModule,
    NotificationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
