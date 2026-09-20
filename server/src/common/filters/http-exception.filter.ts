import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = -1;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string) || exception.message;
        code = (r.code as number) || status;
      }
    } else if (exception instanceof Error) {
      // 非业务异常（如数据库连接失败）：服务端记录完整堆栈，客户端只看到通用提示
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
      const nodeEnv = process.env.NODE_ENV;
      if (nodeEnv === 'production' || nodeEnv === 'test') {
        message = '服务暂时不可用，请稍后重试';
      } else {
        message = exception.message;
      }
    }

    response.status(status).json({
      code,
      message,
      data: null,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
