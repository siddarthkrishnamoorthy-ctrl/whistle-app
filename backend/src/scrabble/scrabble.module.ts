import { Module } from "@nestjs/common";
import { ScrabbleService } from "./scrabble.service";
import { ScrabbleController } from "./scrabble.controller";
import { ScoringModule } from "../scoring/scoring.module";
import { TournamentsModule } from "../tournaments/tournaments.module";

// Scrabble module (Whistle Scrabble Module v1.0): one server-validated Scrabble
// surface reused by vs-computer, friendly, Community, Match Center fixtures and
// tournament matches — results feed the same standings and rating engines as
// every other sport. Mirrors the Chess module 1:1.
@Module({
  imports: [ScoringModule, TournamentsModule],
  controllers: [ScrabbleController],
  providers: [ScrabbleService],
})
export class ScrabbleModule {}
