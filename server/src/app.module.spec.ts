import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

/**
 * 模块装配（依赖注入）冒烟测试。
 *
 * 背景：`tsc` 与 `jest` 只能发现类型与逻辑错误，**无法发现 NestJS 的 DI 装配错误**。
 * 曾出现过 HealthService 注入 PrismaService 但 HealthModule 未 import PrismaModule
 * 的情况：编译通过、单测通过，但容器启动即崩溃（Nest can't resolve dependencies），
 * 导致 CI 绿灯、部署后健康检查失败并自动回滚。
 *
 * 这里用 overrideProvider 替换 PrismaService，避免测试期真实连库，
 * 只验证「整棵模块树的依赖能否装配完成」。
 */
describe('AppModule DI 装配', () => {
  it('模块依赖可完整解析（不连接真实数据库）', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn().mockResolvedValue(undefined),
        $disconnect: jest.fn().mockResolvedValue(undefined),
        ping: jest.fn().mockResolvedValue(true),
        onModuleInit: jest.fn().mockResolvedValue(undefined),
        onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
