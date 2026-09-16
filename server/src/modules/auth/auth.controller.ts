import { Body, Controller, Get, Post, Put, Ip } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MiniLoginDto } from './dto/mini-login.dto';
import { RealNameAuthDto } from './dto/real-name-auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from './strategies/jwt.strategy';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @ApiOperation({ summary: 'PC端登录' })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.account, dto.password);
  }

  @Public()
  @ApiOperation({ summary: '小程序微信登录' })
  @Post('mini-login')
  miniLogin(@Body() dto: MiniLoginDto, @Ip() ip: string) {
    return this.authService.miniLogin(dto.code, ip);
  }

  @ApiOperation({ summary: '获取当前用户信息' })
  @Get('profile')
  getProfile(@CurrentUser() user: RequestUser) {
    return this.authService.getProfile(user.id);
  }

  @ApiOperation({ summary: '修改密码' })
  @Put('password')
  changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: { oldPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(user.id, dto.oldPassword, dto.newPassword);
  }

  @ApiOperation({ summary: '更新个人信息' })
  @Put('profile')
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: { username?: string; phone?: string },
  ) {
    return this.authService.updateProfile(user.id, dto);
  }

  @ApiOperation({ summary: '小程序实名认证' })
  @Post('real-name-auth')
  submitRealName(
    @CurrentUser() user: RequestUser,
    @Body() dto: RealNameAuthDto,
  ) {
    return this.authService.submitRealName(user.id, dto);
  }
}
