import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { Role, Prisma } from '@prisma/client';
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
    await this.seedProductsIfEmpty();

    // ==============================================================
    // VÙNG MỞ RỘNG: Thêm các module khác sau này tại đây
    // ==============================================================
    // await this.seedOrdersIfEmpty();
  }

  /**
   * Kiểm tra bảng Product: nếu chưa có data thì tạo các sản phẩm mẫu
   */
  async seedProductsIfEmpty() {
    const productCount = await this.prisma.product.count();
    if (productCount === 0) {
      this.logger.warn('Bảng Product chưa có dữ liệu. Bắt đầu tự động tạo sản phẩm mẫu...');
      await this.createSampleProducts();
    } else {
      this.logger.log(`Bảng Product đã có ${productCount} sản phẩm. Bỏ qua tạo dữ liệu fake.`);
    }
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

  /**
   * Tạo danh sách sản phẩm mẫu ban đầu
   */
  async createSampleProducts() {
    this.logger.log('Bắt đầu khởi tạo các sản phẩm mẫu...');

    const sampleProducts = [
      {
        name: 'Áo thun Cotton Compact Premium',
        slug: 'ao-thun-cotton-compact-premium',
        description: 'Chất liệu 100% cotton thoáng mát, thấm hút mồ hôi tốt, form dáng trẻ trung hiện đại.',
        price: new Prisma.Decimal(189000),
        quantity: 120,
        imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&q=80',
        isActive: true,
      },
      {
        name: 'Quần Jean Slimfit Co Giãn 4 Chiều',
        slug: 'quan-jean-slimfit-co-gian-4-chieu',
        description: 'Vải denim cao cấp bền màu, co giãn thoải mái khi vận động cả ngày.',
        price: new Prisma.Decimal(450000),
        quantity: 85,
        imageUrl: 'https://images.unsplash.com/photo-1542272604-780c96856592?w=500&q=80',
        isActive: true,
      },
      {
        name: 'Giày Sneaker Phố Classic White',
        slug: 'giay-sneaker-pho-classic-white',
        description: 'Đế cao su êm ái, đệm lót êm chân, phù hợp dạo phố và đi làm hàng ngày.',
        price: new Prisma.Decimal(690000),
        quantity: 40,
        imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&q=80',
        isActive: true,
      },
      {
        name: 'Áo Khoác Bomber Gió Kháng Nước',
        slug: 'ao-khoac-bomber-gio-khang-nuoc',
        description: 'Lớp ngoài cản gió chống nước nhẹ, lót dù bên trong giữ ấm hiệu quả.',
        price: new Prisma.Decimal(360000),
        quantity: 60,
        imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&q=80',
        isActive: true,
      },
      {
        name: 'Balo Laptop Chống Nước 15.6 inch',
        slug: 'balo-laptop-chong-nuoc-15-6-inch',
        description: 'Nhiều ngăn tiện lợi, đệm lưng êm ái, tích hợp cổng sạc USB thông minh.',
        price: new Prisma.Decimal(520000),
        quantity: 35,
        imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80',
        isActive: true,
      },
      {
        name: 'Đồng Hồ Thể Thao Digital Chrono',
        slug: 'dong-ho-the-thao-digital-chrono',
        description: 'Chống nước 5ATM, dạ quang ban đêm, báo thức và bấm giờ thể thao đa năng.',
        price: new Prisma.Decimal(280000),
        quantity: 50,
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
        isActive: true,
      },
      {
        name: 'Kính Mát Unisex Chống Tia UV400',
        slug: 'kinh-mat-unisex-chong-tia-uv400',
        description: 'Gọng titan siêu nhẹ, tròng polarized bảo vệ mắt toàn diện khi ra đường.',
        price: new Prisma.Decimal(210000),
        quantity: 75,
        imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500&q=80',
        isActive: true,
      },
      {
        name: 'Ví Da Nam Mini Dáng Đứng',
        slug: 'vi-da-nam-mini-dang-dung',
        description: 'Chất liệu da bò thật 100%, thiết kế nhỏ gọn đựng vừa các loại thẻ ngân hàng.',
        price: new Prisma.Decimal(250000),
        quantity: 0,
        imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=500&q=80',
        isActive: false,
      },
    ];

    const result = await this.prisma.product.createMany({
      data: sampleProducts,
      skipDuplicates: true,
    });

    this.logger.log(`Đã tạo thành công ${result.count} sản phẩm mẫu.`);
    return result;
  }
}
