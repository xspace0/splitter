import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsPhoneNumber,
  MinLength,
  MaxLength,
} from 'class-validator';
import { RoleType } from '@/common/enums/role.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: '姓名不能为空' })
  @MaxLength(50)
  username!: string;

  @IsString()
  @IsNotEmpty({ message: '账号不能为空' })
  @MinLength(3, { message: '账号至少3个字符' })
  @MaxLength(50)
  account!: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码至少6个字符' })
  @MaxLength(50)
  password!: string;

  @IsEnum(RoleType, { message: '角色类型不合法' })
  roleType!: RoleType;

  @IsOptional()
  @IsString()
  regionId?: string | null;

  @IsOptional()
  @IsString()
  @IsPhoneNumber('CN', { message: '手机号格式不正确' })
  phone?: string;

  @IsOptional()
  @IsString()
  idCardNo?: string;
}
