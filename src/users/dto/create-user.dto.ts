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
  passwordHash: string; // hoặc đặt tên là password nếu client gửi lên mật khẩu thô

  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @IsString()
  fullName: string; // Bắt buộc, bỏ dấu '?'
  @IsOptional()
  @IsString()
  phoneNumber?: string;
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
  @IsOptional()
  isActive?: boolean;
}
