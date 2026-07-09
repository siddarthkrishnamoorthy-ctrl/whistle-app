import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SignupDto } from "./dto/signup.dto";
import { SignupParentDto } from "./dto/signup-parent.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { LinkPlayerDto } from "./dto/link-player.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "./jwt-payload";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("signup")
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post("signup-parent")
  signupParent(@Body() dto: SignupParentDto) {
    return this.authService.signupParent(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("link-player")
  @UseGuards(JwtAuthGuard)
  linkPlayer(@CurrentUser() user: AuthenticatedUser, @Body() dto: LinkPlayerDto) {
    return this.authService.linkPlayer(user.sub, dto.code);
  }

  @Get("me/children")
  @UseGuards(JwtAuthGuard)
  myChildren(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.myChildren(user.sub);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  logout(@Body() dto: RefreshDto, @CurrentUser() _user: AuthenticatedUser) {
    return this.authService.logout(dto.refreshToken).then(() => ({ success: true }));
  }
}
