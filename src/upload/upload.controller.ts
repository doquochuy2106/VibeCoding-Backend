import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createMulterOptions } from './upload.helper';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * API tải lên hình ảnh sản phẩm
   * Lưu vật lý vào: public/product/
   * URL truy cập: /public/product/<tên_file>
   */
  @Post('product')
  @UseInterceptors(
    FileInterceptor('file', createMulterOptions('product', 'prod')),
  )
  uploadProductImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file hình ảnh để tải lên');
    }
    return this.uploadService.formatFileResponse(file, 'product');
  }

  // Alias tương thích ngược cho endpoint cũ
  @Post('product-image')
  @UseInterceptors(
    FileInterceptor('file', createMulterOptions('product', 'prod')),
  )
  uploadProductImageAlias(@UploadedFile() file: Express.Multer.File) {
    return this.uploadProductImage(file);
  }

  /**
   * API tải lên avatar / ảnh người dùng
   * Lưu vật lý vào: public/user/
   * URL truy cập: /public/user/<tên_file>
   */
  @Post('user')
  @UseInterceptors(
    FileInterceptor('file', createMulterOptions('user', 'user')),
  )
  uploadUserImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file hình ảnh để tải lên');
    }
    return this.uploadService.formatFileResponse(file, 'user');
  }

  // Alias tương thích cho endpoint avatar
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', createMulterOptions('user', 'user')),
  )
  uploadAvatarAlias(@UploadedFile() file: Express.Multer.File) {
    return this.uploadUserImage(file);
  }

  /**
   * API tải lên hình ảnh chung khác
   * Lưu vật lý vào: public/general/
   */
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', createMulterOptions('general', 'img')),
  )
  uploadGeneralImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file hình ảnh để tải lên');
    }
    return this.uploadService.formatFileResponse(file, 'general');
  }
}
