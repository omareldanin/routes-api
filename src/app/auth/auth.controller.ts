import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
  Patch,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoggedInUserType, loginDto } from "./auth.dto";
import { JwtAuthGuard } from "src/middlewares/jwt-auth.guard";
import { NoFilesInterceptor } from "@nestjs/platform-express";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  //sign in request-----------------------------
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(NoFilesInterceptor())
  @Post("/login")
  signIn(@Body() signInDto: loginDto) {
    return this.authService.signIn(
      signInDto.phone,
      signInDto.password,
      signInDto.fcm
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post("/validate-token")
  @UseGuards(JwtAuthGuard)
  refreshToken() {
    return {
      message: "success",
    };
  }

  //reset user password --------------------------
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(NoFilesInterceptor())
  @UseGuards(JwtAuthGuard)
  @Post("/reset-password")
  resetPassword(
    @Body()
    resetPassDTo: {
      password: string;
      oldPassword: string | undefined;
    },
    @Req() req
  ) {
    const loggedInUser = req.user as LoggedInUserType;

    return this.authService.resetPassword({
      id: loggedInUser.id,
      password: resetPassDTo.password,
      oldPassword: resetPassDTo.oldPassword,
    });
  }
}
