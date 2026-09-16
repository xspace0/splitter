import { IsOptional, IsNumberString } from 'class-validator';

export class QueryPermissionDto {
  @IsOptional()
  @IsNumberString({}, { message: '用户ID格式错误' })
  userId?: string;

  @IsOptional()
  @IsNumberString({}, { message: '社区ID格式错误' })
  communityId?: string;
}
