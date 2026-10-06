import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FindUserDto } from './dto/find-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CreateAuthDto } from 'src/auth/dto/create-auth.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByUsername(username: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: username }, { phone: username }],
      },
    });
  }

  async comparePasswordUser(UserPassword: string, hashPassword: string) {
    return await bcrypt.compare(UserPassword, hashPassword);
  }

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

  async findAll(queryOrPage?: FindUserDto | number, limitParam?: number) {
    let page = 1;
    let limit = 10;
    let search: string | undefined;
    let name: string | undefined;
    let email: string | undefined;
    let role: string | undefined;
    let sortBy: string | undefined;
    let sortOrder: 'asc' | 'desc' = 'desc';

    if (typeof queryOrPage === 'number') {
      page = queryOrPage > 0 ? queryOrPage : 1;
      limit = limitParam && limitParam > 0 ? limitParam : 10;
    } else if (queryOrPage && typeof queryOrPage === 'object') {
      page =
        queryOrPage.page && queryOrPage.page > 0 ? Number(queryOrPage.page) : 1;
      limit =
        queryOrPage.limit && queryOrPage.limit > 0
          ? Number(queryOrPage.limit)
          : 10;
      search = queryOrPage.search;
      name = queryOrPage.name;
      email = queryOrPage.email;
      role = queryOrPage.role;
      sortBy = queryOrPage.sortBy || queryOrPage.sort || queryOrPage.orderBy;
      const order = queryOrPage.sortOrder || queryOrPage.order;
      if (order && ['asc', 'desc'].includes(order.toLowerCase())) {
        sortOrder = order.toLowerCase() as 'asc' | 'desc';
      }
    }

    const skip = (page - 1) * limit;

    // 1/ Tìm kiếm theo tên, email, tìm kiếm theo role (tất cả vai trò)
    const andConditions: Prisma.UserWhereInput[] = [];

    // Tìm kiếm chung (search) theo tên hoặc email
    if (search && search.trim()) {
      const keyword = search.trim();
      const orConditions: Prisma.UserWhereInput[] = [
        { name: { contains: keyword } },
        { email: { contains: keyword } },
      ];

      const upperKeyword = keyword.toUpperCase();
      if (upperKeyword === Role.ADMIN || upperKeyword === Role.CUSTOMER) {
        orConditions.push({ role: upperKeyword as Role });
      }

      andConditions.push({ OR: orConditions });
    }

    // Tìm kiếm riêng theo tên
    if (name && name.trim()) {
      andConditions.push({
        name: { contains: name.trim() },
      });
    }

    // Tìm kiếm riêng theo email
    if (email && email.trim()) {
      andConditions.push({
        email: { contains: email.trim() },
      });
    }

    // Tìm kiếm theo role:
    // - Nếu role là 'ALL', 'all' hoặc không truyền thì lấy tất cả vai trò
    // - Nếu role là ADMIN hoặc CUSTOMER thì lọc theo role đó
    if (role && role.trim()) {
      const normalizedRole = role.trim().toUpperCase();
      if (normalizedRole !== 'ALL') {
        if (normalizedRole === Role.ADMIN || normalizedRole === Role.CUSTOMER) {
          andConditions.push({ role: normalizedRole as Role });
        }
      }
    }

    const where: Prisma.UserWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    // 2/ Sort theo ID, name, email, role, created
    const sortFieldMapping: Record<
      string,
      keyof Prisma.UserOrderByWithRelationInput
    > = {
      id: 'id',
      ID: 'id',
      name: 'name',
      email: 'email',
      role: 'role',
      created: 'createdAt',
      createdAt: 'createdAt',
      created_at: 'createdAt',
    };

    let targetSortField: keyof Prisma.UserOrderByWithRelationInput =
      'createdAt';
    let targetDirection: Prisma.SortOrder = sortOrder;

    if (sortBy && sortBy.trim()) {
      let rawField = sortBy.trim();
      // Hỗ trợ định dạng "field,asc" hoặc "field:desc"
      if (rawField.includes(',') || rawField.includes(':')) {
        const [fieldPart, dirPart] = rawField.split(/[,:]/);
        rawField = fieldPart.trim();
        if (dirPart && ['asc', 'desc'].includes(dirPart.trim().toLowerCase())) {
          targetDirection = dirPart.trim().toLowerCase() as Prisma.SortOrder;
        }
      }

      if (sortFieldMapping[rawField]) {
        targetSortField = sortFieldMapping[rawField];
      } else if (sortFieldMapping[rawField.toLowerCase()]) {
        targetSortField = sortFieldMapping[rawField.toLowerCase()];
      }
    }

    const orderBy: Prisma.UserOrderByWithRelationInput[] = [
      { [targetSortField]: targetDirection },
    ];
    // Tie-breaker ổn định phân trang
    if (targetSortField !== 'id') {
      orderBy.push({ id: 'desc' });
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        omit: { password: true },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      meta: {
        page,
        total,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data,
    };
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
        role: updateUserDto.role,
      },
      omit: { password: true },
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

  async register(createAuthDto: CreateAuthDto) {
    const { email, password } = createAuthDto;
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
      data: { ...createAuthDto, password: hashPassword },
      omit: { password: true },
    });

    return user;
  }
}
