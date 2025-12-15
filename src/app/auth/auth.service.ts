import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { UsersService } from "src/app/users/users.service";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { env } from "src/config";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async signIn(phone: string, password: string, fcm: string | undefined) {
    let user = await this.usersService.findOne({
      phone: phone,
    });

    if (!user) {
      throw new UnauthorizedException("خطأ في البيانات , اعد المحاوله");
    } else if (
      user &&
      !bcrypt.compareSync(
        password + (env.PASSWORD_SALT as string),
        user.password
      )
    ) {
      throw new UnauthorizedException("خطأ في البيانات , اعد المحاوله");
    }

    if (user.role === "COMPANY_ADMIN") {
      const company = user.company;
      if (!company)
        throw new BadRequestException("خطأ في البيانات , اعد المحاوله");

      if (
        company.supscriptionEndDate &&
        company.supscriptionEndDate < new Date()
      ) {
        throw new BadRequestException("خطأ في البيانات , اعد المحاوله");
      }
    }

    const payload = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      superAdmin: user.admin?.superAdmin,
    };

    const token = this.jwtService.sign(payload, {
      secret: env.ACCESS_TOKEN_SECRET as string,
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    });

    const refreshToken = this.jwtService.sign(
      {
        id: user?.id,
      },
      {
        secret: env.REFRESH_TOKEN_SECRET as string,
        expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
      }
    );

    const result = await this.usersService.updateToken({
      id: +user.id,
      refreshToken,
      fcm,
    });

    return {
      message: "تم تسجيل الدخول بنجاح",
      token,
      refreshToken: result.refresh_token,
    };
  }

  async refreshToken(refresh_token: string) {
    // 1) Check if token is valid
    const decoded = this.jwtService.verify(refresh_token, {
      secret: env.REFRESH_TOKEN_SECRET as string,
    }) as {
      id: number;
    };

    // 2) Check if refresh token is in the database
    const refreshTokens = await this.usersService.getUserRefreshTokens(
      decoded.id
    );

    if (!refreshTokens || !refreshTokens.includes(refresh_token)) {
      throw new UnauthorizedException("الرجاء تسجيل الدخول");
    }

    const user = await this.usersService.getUserByID(decoded.id);
    if (!user) {
      throw new UnauthorizedException("الرجاء تسجيل الدخول");
    }

    const payload = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      permissions: user.admin.permissions,
      online: user.delivery.online,
    };

    const token = this.jwtService.sign(payload, {
      secret: env.ACCESS_TOKEN_SECRET as string,
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    });

    return {
      message: "success",
      token: token,
    };
  }

  async resetPassword(data: {
    id: number;
    password: string;
    oldPassword: string;
  }) {
    let user = await this.usersService.findOne({
      id: data.id,
    });

    if (
      user &&
      data.oldPassword &&
      !bcrypt.compareSync(
        data.oldPassword + (env.PASSWORD_SALT as string),
        user.password
      )
    ) {
      throw new UnauthorizedException("خطأ في البيانات , اعد المحاوله");
    } else {
      await this.usersService.resetPassword({
        id: user.id,
        password: data.password,
      });
    }

    const payload = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      permissions: user.admin?.permissions,
    };

    const token = this.jwtService.sign(payload, {
      secret: env.ACCESS_TOKEN_SECRET as string,
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    });

    const refreshToken = this.jwtService.sign(
      {
        id: user?.id,
      },
      {
        secret: env.REFRESH_TOKEN_SECRET as string,
        expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
      }
    );

    const result = await this.usersService.updateToken({
      id: +user.id,
      refreshToken,
      fcm: undefined,
    });

    return {
      message: "تم تغيير الرقم السري بنجاح",
      token,
      refreshToken: result.refresh_token,
    };
  }
}
