import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsOptional()
  @IsString({ message: 'refreshToken phải là chuỗi ký tự' })
  refreshToken?: string;
}
