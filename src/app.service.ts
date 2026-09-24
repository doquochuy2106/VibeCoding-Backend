import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello1(): string {
    return 'Hello World! Đỗ Quốc Huy';
  }
}
