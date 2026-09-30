import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { email, passwordHash } = createUserDto;
    //check email
    const userEmail = await this.prisma.user.findUnique({
      where: { email: email },
    });
    if (userEmail) {
      throw new BadRequestException(`Email ${email} đã tồn tại`);
    }

    //hash password
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(passwordHash, salt);

    //save user
    const user = await this.prisma.user.create({
      data: { ...createUserDto, passwordHash: hashPassword },
      omit: { passwordHash: true },
    });

    return user;
  }

  async findAll() {
    return await this.prisma.user.findMany({ omit: { passwordHash: true } });
  }

  async findOne(id: number) {
    return await this.prisma.user.findUnique({
      where: { id: id },
      omit: { passwordHash: true },
    });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
