import { Module } from "@nestjs/common";
import { ScoringController } from "./scoring.controller";
import { ScoringService } from "./scoring.service";
import { RatingModule } from "../rating/rating.module";

@Module({
  imports: [RatingModule],
  controllers: [ScoringController],
  providers: [ScoringService],
})
export class ScoringModule {}
