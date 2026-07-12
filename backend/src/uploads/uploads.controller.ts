import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { randomUUID } from "crypto";
import { extname, join } from "path";
import { existsSync, mkdirSync } from "fs";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AcademyRequiredGuard } from "../common/guards/academy-required.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";

const UPLOAD_ROOT = join(process.cwd(), "uploads");
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Local-disk storage for now — the TDD's target is an S3-compatible bucket
// (Section 3.1), but that needs the user's own cloud credentials. This keeps
// the same "upload → get back a URL" contract so swapping the storage
// backend later doesn't change the API shape the frontend depends on.
@Controller("uploads")
@UseGuards(JwtAuthGuard, AcademyRequiredGuard, RolesGuard)
export class UploadsController {
  @Post("image")
  @Roles("admin", "head_coach")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const user = (req as unknown as { user: AuthenticatedUser }).user;
          const dir = join(UPLOAD_ROOT, user.academyId as string);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          cb(new BadRequestException("Only JPEG, PNG, WEBP or GIF images are allowed."), false);
          return;
        }
        cb(null, true);
      },
    })
  )
  uploadImage(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    if (!file) throw new BadRequestException("No file uploaded.");
    return { url: `/uploads/${user.academyId}/${file.filename}` };
  }
}
