import { Injectable, Logger } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

export interface UploadFileResponse {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  /**
   * Định dạng kết quả trả về sau khi tải file lên thành công
   */
  formatFileResponse(
    file: Express.Multer.File,
    subFolder: string,
  ): UploadFileResponse {
    const url = `/public/${subFolder}/${file.filename}`;
    return {
      url,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  /**
   * Xóa an toàn file trên ổ cứng local nếu đường dẫn thuộc thư mục public hoặc uploads
   */
  deleteFile(fileUrlOrPath?: string | null): boolean {
    if (!fileUrlOrPath) return false;

    try {
      const normalizedPath = fileUrlOrPath.replace(/\\/g, '/');
      let relativePath: string | null = null;

      const publicIndex = normalizedPath.indexOf('/public/');
      const uploadIndex = normalizedPath.indexOf('/uploads/');

      if (publicIndex !== -1) {
        relativePath = normalizedPath.substring(publicIndex + 1);
      } else if (uploadIndex !== -1) {
        relativePath = normalizedPath.substring(uploadIndex + 1);
      } else if (normalizedPath.startsWith('public/')) {
        relativePath = normalizedPath;
      } else if (normalizedPath.startsWith('uploads/')) {
        relativePath = normalizedPath;
      }

      if (!relativePath) return false;

      const absolutePath = join(process.cwd(), relativePath);
      if (existsSync(absolutePath)) {
        unlinkSync(absolutePath);
        this.logger.log(`Đã xóa file: ${absolutePath}`);
        return true;
      }
    } catch (error) {
      this.logger.error(`Lỗi khi xóa file (${fileUrlOrPath}):`, error);
    }

    return false;
  }
}
