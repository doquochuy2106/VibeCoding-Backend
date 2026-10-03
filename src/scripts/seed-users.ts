import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AppService } from '../app.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const appService = app.get(AppService);

  const count = process.env.COUNT ? parseInt(process.env.COUNT, 10) : 100;
  console.log(`\n⏳ Đang khởi tạo ${count} fake users...`);

  const result = await appService.createFakeUsers(count);
  console.log(`✅ ${result.message}`);
  console.log(`🔑 Mật khẩu mặc định cho các tài khoản: ${result.defaultPassword}\n`);

  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Lỗi khi seed fake users:', err);
  process.exit(1);
});
