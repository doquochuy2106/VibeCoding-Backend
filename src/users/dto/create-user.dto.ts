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

  name?: string;
  phone?: string;
}
