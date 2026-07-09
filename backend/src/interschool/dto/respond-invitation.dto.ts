import { IsIn } from "class-validator";

export class RespondInvitationDto {
  @IsIn(["accepted", "declined"])
  status!: "accepted" | "declined";
}
