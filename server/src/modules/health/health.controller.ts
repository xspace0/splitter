import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async check(@Res() res: Response) {
    const result = await this.healthService.check();
    const status = result.database === 'disconnected' ? 503 : 200;
    res.status(status).json(result);
  }
}
