import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TournamentsService } from "./tournaments.service";
import {
  TournamentAuthController,
  TournamentPublicController,
  TournamentsController,
} from "./tournaments.controller";

// Standalone tournament vertical (BRD): its own user master, its own auth
// endpoints, no academy tenancy. Shares only the JWT signing infra.
@Module({
  imports: [JwtModule.register({})],
  controllers: [TournamentAuthController, TournamentPublicController, TournamentsController],
  providers: [TournamentsService],
})
export class TournamentsModule {}
