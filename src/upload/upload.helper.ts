import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

/**
 * Tạo cấu hình Multer lưu vào thư mục con chỉ định bên trong thư mục 'uploads'
 * @param subFolder Tên thư mục con (ví dụ: 'products', 'avatars', 'general')
 * @param prefix Tiền tố đặt trước tên file (ví dụ: 'prod', 'avatar')
 * @param maxFileSize Dung lượng tối đa (bytes), mặc định 5MB
 */
export function createMulterOptions(
  subFolder: string = 'general',
  prefix: string = subFolder,
  maxFileSize: number = 5 * 1024 * 1024,
): MulterOptions {
  const uploadDir = join(process.cwd(), 'public', subFolder);

  return {
    storage: diskStorage({
      destination: (req, file, callback) => {
        if (!existsSync(uploadDir)) {
          mkdirSync(uploadDir, { recursive: true });
        }
        callback(null, uploadDir);
      },
      filename: (req, file, callback) => {
        const ext = extname(file.originalname).toLowerCase();
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const filename = `${prefix}-${uniqueSuffix}${ext}`;
        callback(null, filename);
      },
    }),
    fileFilter: (req, file, callback) => {
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
      ];
      if (allowedMimeTypes.includes(file.mimetype)) {
        callback(null, true);
      } else {
        callback(
          new BadRequestException(
            'Định dạng file không hợp lệ! Chỉ cho phép tải lên hình ảnh (JPG, PNG, WEBP, GIF).',
          ),
          false,
        );
      }
    },
    limits: {
      fileSize: maxFileSize,
    },
  };
}
