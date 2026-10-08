import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Response } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prismaService: PrismaService,
  ) {}

  private setRefreshTokenCookie(
    res: Response,
    refreshToken: string,
    expiredAt: Date,
  ) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      expires: expiredAt,
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie('refreshToken', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });
  }

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findUserByUsername(username);
    if (!user) {
      throw new BadRequestException('Không tìm thấy email hoặc số điện thoại');
    }
    const checkPasswordUsser = await this.usersService.comparePasswordUser(
      pass,
      user.password,
    );
    if (user && checkPasswordUsser) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any, res?: Response) {
    const payload = {
      id: user.id,
      username: user.name,
      phone: user.phone,
      role: user.role,
    };
    const access_token = this.jwtService.sign(payload);

    // 1. Tạo refresh token ngẫu nhiên
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    // 2. Hash refresh token để lưu vào database
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');
    // 3. Thời hạn hết hạn (7 ngày)
    const expiredAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Xóa các refresh token đã hết hạn trước đó của user này (nếu có)
    await this.prismaService.refreshToken
      .deleteMany({
        where: {
          userId: user.id,
          expiredAt: { lt: new Date() },
        },
      })
      .catch(() => {});

    // Lưu refresh token mới vào database
    await this.prismaService.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiredAt,
      },
    });

    // 4. Lưu refresh token vào cookies
    if (res) {
      this.setRefreshTokenCookie(res, rawRefreshToken, expiredAt);
    }

    return {
      username: user.name,
      role: user.role,
      access_token: access_token,
      refresh_token: rawRefreshToken,
    };
  }

  async refresh(refreshToken: string, res?: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException(
        'Không tìm thấy refresh token trong request hoặc cookie',
      );
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const tokenRecord = await this.prismaService.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.expiredAt < new Date()) {
      if (tokenRecord) {
        await this.prismaService.refreshToken
          .delete({ where: { id: tokenRecord.id } })
          .catch(() => {});
      }
      if (res) {
        this.clearRefreshTokenCookie(res);
      }
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    const user = tokenRecord.user;
    const payload = {
      id: user.id,
      username: user.name,
      phone: user.phone,
      role: user.role,
    };
    const access_token = this.jwtService.sign(payload);

    // Xoay vòng Refresh Token (Token Rotation)
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = crypto
      .createHash('sha256')
      .update(newRawRefreshToken)
      .digest('hex');
    const newExpiredAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prismaService.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        tokenHash: newTokenHash,
        expiredAt: newExpiredAt,
      },
    });

    if (res) {
      this.setRefreshTokenCookie(res, newRawRefreshToken, newExpiredAt);
    }

    return {
      username: user.name,
      role: user.role,
      access_token: access_token,
      refresh_token: newRawRefreshToken,
    };
  }

  async logout(refreshToken: string, res?: Response) {
    if (refreshToken) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      await this.prismaService.refreshToken
        .deleteMany({
          where: { tokenHash },
        })
        .catch(() => {});
    }

    if (res) {
      this.clearRefreshTokenCookie(res);
    }

    return { message: 'Đăng xuất thành công' };
  }

  async register(createAuthDto: CreateAuthDto) {
    const user = this.usersService.register(createAuthDto);
    return user;
  }
}
