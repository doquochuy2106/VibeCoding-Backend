import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { Role } from '@prisma/client';
import { fakerVI, faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lifecycle Hook: Chạy tự động ngay khi khởi động server
   */
  async onModuleInit() {
    await this.autoSeedData();
  }

  /**
   * Quản lý tự động kiểm tra và tạo dữ liệu fake khi bảng còn trống
   */
  async autoSeedData() {
    this.logger.log('--- Kiểm tra dữ liệu khởi tạo (Auto Seed) ---');
    await this.seedUsersIfEmpty(100);

    // ==============================================================
    // VÙNG MỞ RỘNG: Thêm các module khác sau này tại đây
    // ==============================================================
    // await this.seedProductsIfEmpty();
    // await this.seedOrdersIfEmpty();
  }

  /**
   * Kiểm tra bảng User: nếu chưa có data (count === 0) thì tạo fake user, có rồi thì bỏ qua
   */
  async seedUsersIfEmpty(count = 100) {
    const userCount = await this.prisma.user.count();
    if (userCount === 0) {
      this.logger.warn(
        `Bảng User chưa có dữ liệu. Bắt đầu tự động tạo ${count} fake users...`,
      );
      await this.createFakeUsers(count);
    } else {
      this.logger.log(
        `Bảng User đã có ${userCount} người dùng. Bỏ qua tạo dữ liệu fake.`,
      );
    }
  }

  getHello1(): string {
    return 'Hello World! Đỗ Quốc Huy';
  }

  /**
   * Helper: Bỏ dấu tiếng Việt để tạo email/username hợp lệ và tự nhiên
   */
  private removeVietnameseTones(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Helper: Sinh số điện thoại di động Việt Nam ngẫu nhiên (10 số)
   */
  private generateVietnamesePhone(): string {
    const prefixes = [
      '090',
      '091',
      '092',
      '093',
      '094',
      '096',
      '097',
      '098',
      '086',
      '088',
      '089',
      '032',
      '033',
      '034',
      '035',
      '036',
      '037',
      '038',
      '039',
      '070',
      '079',
      '077',
      '076',
      '078',
    ];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(1000000 + Math.random() * 9000000).toString();
    return `${prefix}${suffix}`;
  }

  /**
   * Sinh danh sách người dùng giả lập (Fake Users) tiếng Việt
   * @param count Số lượng user cần tạo (mặc định 100)
   * @param defaultPassword Mật khẩu mặc định (mặc định: '123456')
   */
  async createFakeUsers(count = 100, defaultPassword = '123456') {
    this.logger.log(`Bắt đầu tạo ${count} fake users...`);

    // Mã hóa mật khẩu 1 lần duy nhất để tối ưu tốc độ khi tạo số lượng lớn
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(defaultPassword, salt);

    const usersData: Array<{
      email: string;
      password: string;
      name: string;
      phone: string;
      role: Role;
    }> = [];
    const generatedEmails = new Set<string>();

    for (let i = 0; i < count; i++) {
      const name = fakerVI.person.fullName();
      const slugName = this.removeVietnameseTones(name);
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);

      let email = `${slugName}.${randomSuffix}@example.com`;
      while (generatedEmails.has(email)) {
        email = `${slugName}.${Math.floor(10000 + Math.random() * 90000)}@example.com`;
      }
      generatedEmails.add(email);

      const phone = this.generateVietnamesePhone();
      // 90% là CUSTOMER, 10% là ADMIN
      const role = Math.random() < 0.1 ? Role.ADMIN : Role.CUSTOMER;

      usersData.push({
        email,
        password: hashPassword,
        name,
        phone,
        role,
      });
    }

    // Lưu hàng loạt vào database với createMany (skipDuplicates nếu trùng)
    const result = await this.prisma.user.createMany({
      data: usersData,
      skipDuplicates: true,
    });

    this.logger.log(`Đã tạo thành công ${result.count} fake users.`);

    return {
      message: `Tạo thành công ${result.count} fake users`,
      totalCreated: result.count,
      defaultPassword,
      users: usersData.map(
        ({ password: _, ...userWithoutPassword }) => userWithoutPassword,
      ),
    };
  }

  /**
   * Xóa các fake user có email kết thúc bằng @example.com để làm sạch DB khi cần
   */
  async cleanFakeUsers() {
    const result = await this.prisma.user.deleteMany({
      where: {
        email: {
          endsWith: '@example.com',
        },
      },
    });

    return {
      message: `Đã xóa ${result.count} fake users (@example.com)`,
      deletedCount: result.count,
    };
  }

  // ==============================================================
  // VÙNG MỞ RỘNG: Tạo fake data cho các module khác sau này tại đây
  // ==============================================================
  // async createFakeProducts(count = 10) { ... }
  // async createFakeOrders(count = 10) { ... }
}
