import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "src/middlewares/jwt-auth.guard";
import { LoggedInUserType } from "../auth/auth.dto";
import { CreateUserDto, UpdateUserDto } from "./user.dto";
import { UploadImageInterceptor } from "src/middlewares/file-upload.interceptor";

@Controller("users")
export class UsersController {
  constructor(private userService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @UploadImageInterceptor("avatar")
  @Post("/create-user")
  async create(
    @Body() dto: CreateUserDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req
  ) {
    const loggedInUser = req.user as LoggedInUserType;

    if (file) {
      dto.avatar = "uploads/" + file.filename; // or save full path if you want
    }

    if (loggedInUser.role === "COMPANY_ADMIN") {
      dto.companyId = loggedInUser.id;
    }

    const user = await this.userService.createUser(dto);
    return { message: "success", user };
  }

  @UseGuards(JwtAuthGuard)
  @Get("/get-profile")
  getUserProfile(@Req() req) {
    const loggedInUser = req.user as LoggedInUserType;

    const user = this.userService.getProfile(+loggedInUser.id);

    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get("/getAll")
  getAll(@Query() filters: any, @Req() req) {
    const loggedInUser = req.user as LoggedInUserType;

    if (loggedInUser.role === "COMPANY_ADMIN") {
      filters.comanyId = loggedInUser.id;
    }
    const result = this.userService.getAllUser(filters);

    return result;
  }
  //update user profile --------------------------
  @UseGuards(JwtAuthGuard)
  @UploadImageInterceptor("avatar")
  @Patch("/update-profile")
  async updateProfile(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: UpdateUserDto,
    @Req() req
  ) {
    const loggedInUser = req.user as LoggedInUserType;
    if (file) {
      data.avatar = "uploads/" + file.filename; // or save full path if you want
    }

    const user = await this.userService.updateProfile(loggedInUser.id, data);
    return {
      message: "success",
      user: { ...user, password: null },
    };
  }

  //update user profile --------------------------
  @UseGuards(JwtAuthGuard)
  @UploadImageInterceptor("avatar")
  @Patch("/:id")
  async updateUser(
    @Param("id") id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() data: UpdateUserDto
  ) {
    if (file) {
      data.avatar = "uploads/" + file.filename; // or save full path if you want
    }
    const user = await this.userService.updateProfile(+id, data);
    return {
      message: "success",
      user: { ...user, password: null },
    };
  }

  //update user profile --------------------------
  @UseGuards(JwtAuthGuard)
  @Get("/:id")
  async getOne(@Param("id") id: number) {
    const user = await this.userService.findOneById({ id: +id });
    return {
      message: "success",
      user: { ...user, password: null },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch("renew/:id")
  renewCompany(@Param("id", ParseIntPipe) id: number, @Req() req) {
    const loggedInUser = req.user as LoggedInUserType;

    if (!loggedInUser.superAdmin) {
      throw new BadRequestException("خطأ في البيانات , اعد المحاوله");
    }
    return this.userService.renewSubscriptionForOne(id);
  }

  // PATCH /companies/renew-all
  @UseGuards(JwtAuthGuard)
  @Patch("renew-all")
  renewAll(@Req() req) {
    const loggedInUser = req.user as LoggedInUserType;

    if (!loggedInUser.superAdmin) {
      throw new BadRequestException("خطأ في البيانات , اعد المحاوله");
    }

    return this.userService.renewAllSubscriptions();
  }

  @UseGuards(JwtAuthGuard)
  @Delete("/delete/:id")
  deleteUser(@Param("id") id: number) {
    const result = this.userService.deleteUser(+id);

    return result;
  }
}
