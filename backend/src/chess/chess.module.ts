import { Module } from "@nestjs/common";
import { ChessService } from "./chess.service";
import { ChessController } from "./chess.controller";
import { TournamentChessController } from "./tournament-chess.controller";
import { ScoringModule } from "../scoring/scoring.module";
import { TournamentsModule } from "../tournaments/tournaments.module";

// Chess module (Whistle Chess Module v1.0): one server-validated chess
// surface reused by friendly games, Match Center fixtures and tournament
// matches — results feed the same standings and rating engines as every
// other sport.
@Module({
  imports: [ScoringModule, TournamentsModule],
  controllers: [ChessController, TournamentChessController],
  providers: [ChessService],
})
export class ChessModule {}
