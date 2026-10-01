import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import bcrypt from 'bcryptjs';
import { table } from 'node:console';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { email, password } = createUserDto;
    //check email
    const userEmail = await this.prisma.user.findUnique({
      where: { email: email },
    });
    if (userEmail) {
      throw new BadRequestException(`Email ${email} đã tồn tại`);
    }

    //hash password
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    //save user
    const user = await this.prisma.user.create({
      data: { ...createUserDto, password: hashPassword },
      omit: { password: true },
    });

    return user;
  }

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const data = await this.prisma.user.findMany({
      omit: { password: true },
      skip: skip,
      take: limit,
    });

    const total = await this.prisma.user.count();

    return {
      page: page,
      total: total,
      limit: limit,
      totalPages: Math.ceil(total / limit),

      data,
    };

    // return await this.prisma.user.findMany({ omit: { password: true } });
  }

  async findOne(id: number) {
    return await this.prisma.user.findUnique({
      where: { id: id },
      omit: { password: true },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const userId = await this.prisma.user.findUnique({ where: { id: id } });
    if (!userId) {
      throw new BadRequestException('ID không dược để trống hoặc không có');
    }
    const user = await this.prisma.user.update({
      where: { id: id },
      data: {
        name: updateUserDto.name,
        phone: updateUserDto.phone,
      },
    });
    return user;
  }

  async remove(id: number) {
    const userId = await this.prisma.user.findUnique({ where: { id: id } });
    if (!userId) {
      throw new BadRequestException('ID không dược để trống hoặc không có');
    }
    return await this.prisma.user.delete({
      where: { id: id },
    });
  }
}
