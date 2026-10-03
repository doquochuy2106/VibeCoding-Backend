import {
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello1();
  }

  /**
   * API tạo fake user qua method POST:
   * POST /fake/users?count=100&password=123456
   */
  @Post('fake/users')
  createFakeUsersPost(
    @Query('count', new DefaultValuePipe(100), ParseIntPipe) count: number,
    @Query('password') password?: string,
  ) {
    return this.appService.createFakeUsers(count, password || '123456');
  }

  /**
   * API tạo fake user qua method GET (tiện lợi test trực tiếp trên trình duyệt):
   * GET /fake/users?count=100
   */
  @Get('fake/users')
  createFakeUsersGet(
    @Query('count', new DefaultValuePipe(100), ParseIntPipe) count: number,
    @Query('password') password?: string,
  ) {
    return this.appService.createFakeUsers(count, password || '123456');
  }

  /**
   * API xóa danh sách fake users đã tạo:
   * DELETE /fake/users
   */
  @Delete('fake/users')
  cleanFakeUsers() {
    return this.appService.cleanFakeUsers();
  }
}

