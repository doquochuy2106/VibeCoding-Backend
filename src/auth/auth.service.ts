import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

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

  async login(user: any) {
    console.log('check user: ', user);
    const payload = {
      id: user.id,
      username: user.name,
      phone: user.phone,
      role: user.role,
    };
    const access_token = this.jwtService.sign(payload);
    return {
      access_token: access_token,
    };
  }
}
