import { IsString, MinLength } from "class-validator";

// Addendum v3 4.2 — academies may relabel entries (e.g. "Reception"/"Year 1")
// without breaking sort order; sortOrder itself is not editable via this
// endpoint since sequencing logic depends on it staying stable.
export class UpdateGradeDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
