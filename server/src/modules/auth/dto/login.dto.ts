import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: '账号', example: 'admin' })
  @IsString()
  @IsNotEmpty({ message: '账号不能为空' })
  account!: string;

  @ApiProperty({ description: '密码', example: 'admin123' })
  @IsString()
  @MinLength(6, { message: '密码长度不能少于6位' })
  password!: string;
}
