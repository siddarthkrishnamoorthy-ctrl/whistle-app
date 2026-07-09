import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import type { User, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { SignupDto } from "./dto/signup.dto";
import type { SignupParentDto } from "./dto/signup-parent.dto";
import type { LoginDto } from "./dto/login.dto";
import type { JwtPayload } from "./jwt-payload";

const REFRESH_TOKEN_BYTES = 48;
const PASSWORD_SALT_ROUNDS = 10;
const REFRESH_TTL_DAYS = 30;
const REFRESH_TTL_DAYS_REMEMBER_ME = 90;
const TRIAL_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Addendum v3 Section 4.2 — default Grade taxonomy seeded on every new academy.
export const DEFAULT_GRADES = [
  "KG",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
];

function hashToken(token: string): string {
  // Refresh tokens are high-entropy random values (not human passwords), so a
  // fast deterministic hash is appropriate and lets us look them up by exact
  // match — bcrypt's per-hash salt would make that impossible.
  return createHash("sha256").update(token).digest("hex");
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string | null; role: UserRole; academyId: string | null };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("An account with this email already exists.");

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const academy = await tx.academy.create({ data: { name: `${dto.fullName}'s Academy` } });
      await tx.grade.createMany({
        data: DEFAULT_GRADES.map((name, i) => ({ academyId: academy.id, name, sortOrder: i })),
      });

      // Addendum v3 5.2 — provision the academy's Whistle subscription at
      // signup time when a declared strength was submitted (the wizard's
      // "how many students" step). Falls back to the Starter tier at
      // strength 1 for the pre-addendum signup flow, so every academy always
      // has exactly one PlatformSubscription row (PlatformBillingService
      // assumes this and only backfills pre-existing academies lazily).
      const declaredStrength = dto.declaredStrength ?? 1;
      const tier = await tx.pricingTier.findFirst({
        where: {
          minStudents: { lte: declaredStrength },
          OR: [{ maxStudents: null }, { maxStudents: { gte: declaredStrength } }],
        },
        orderBy: { minStudents: "asc" },
      });
      if (tier) {
        const now = new Date();
        await tx.platformSubscription.create({
          data: {
            academyId: academy.id,
            declaredStrength,
            pricingTierId: tier.id,
            billingCycle: "monthly",
            status: tier.name === "Enterprise" ? "pending_quote" : "trial",
            trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * MS_PER_DAY),
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * MS_PER_DAY),
          },
        });
      }

      return tx.user.create({
        data: {
          academyId: academy.id,
          name: dto.fullName,
          email: dto.email,
          passwordHash,
          role: "admin",
        },
      });
    });

    return this.issueTokensForUser(user, false);
  }

  async signupParent(dto: SignupParentDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("An account with this email already exists.");

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        academyId: null,
        name: dto.fullName,
        email: dto.email,
        passwordHash,
        role: "parent",
      },
    });

    return this.issueTokensForUser(user, false);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException("Invalid email or password.");
    return this.issueTokensForUser(user, Boolean(dto.rememberMe));
  }

  async refresh(refreshTokenPlain: string): Promise<AuthResult> {
    const tokenHash = hashToken(refreshTokenPlain);
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!record) throw new UnauthorizedException("Invalid or expired refresh token.");

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokensForUser(record.user, record.rememberMe);
  }

  async linkPlayer(userId: string, code: string): Promise<AuthResult> {
    const client = await this.prisma.client.findUnique({ where: { linkCode: code.trim().toUpperCase() } });
    if (!client) throw new NotFoundException("We couldn't find a player with that code.");

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.clientGuardian.upsert({
        where: { clientId_userId: { clientId: client.id, userId } },
        update: {},
        create: { clientId: client.id, userId },
      });
      return tx.user.update({ where: { id: userId }, data: { academyId: client.academyId } });
    });

    // Re-issue tokens immediately so the app doesn't have to wait for a
    // refresh cycle to see the newly attached academyId.
    return this.issueTokensForUser(user, false);
  }

  // Parent app's child selector — not academy-scoped since a not-yet-linked
  // parent's academyId is null (and, in principle, a parent's kids could
  // span more than one academy, though the JWT only carries the most
  // recently linked one today).
  async myChildren(userId: string) {
    const guardianships = await this.prisma.clientGuardian.findMany({
      where: { userId },
      include: {
        client: {
          include: {
            academy: { select: { id: true, name: true } },
            center: { select: { id: true, name: true } },
            // Parent app's child/progress tabs need the enrolled classes (and
            // their sportKey, to look up ratings) without staff-only /clients/:id.
            enrollments: {
              orderBy: { startDate: "desc" },
              include: { class: { select: { id: true, title: true, sportKey: true } } },
            },
          },
        },
      },
    });
    return guardianships.map((g) => g.client);
  }

  async logout(refreshTokenPlain: string): Promise<void> {
    const tokenHash = hashToken(refreshTokenPlain);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokensForUser(user: User, rememberMe: boolean): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, role: user.role, academyId: user.academyId };
    const accessToken = this.jwt.sign(payload as unknown as object, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: (process.env.JWT_ACCESS_TTL || "15m") as JwtSignOptions["expiresIn"],
    });

    const refreshTokenPlain = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
    const ttlDays = rememberMe ? REFRESH_TTL_DAYS_REMEMBER_ME : REFRESH_TTL_DAYS;
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshTokenPlain),
        rememberMe,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenPlain,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, academyId: user.academyId },
    };
  }
}
