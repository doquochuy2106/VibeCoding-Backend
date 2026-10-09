import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role } from '@prisma/client';
export class CreateUserDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;
  @IsNotEmpty({ message: 'Password không được để trống' })
  password: string; // hoặc đặt tên là password nếu client gửi lên mật khẩu thô

  @IsOptional()
  @IsEnum(Role, { message: 'Role không hợp lệ' })
  role?: Role;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Avatar phải là chuỗi ký tự' })
  avatar?: string;
}
