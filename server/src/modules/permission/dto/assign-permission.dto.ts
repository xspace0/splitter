import { IsNumberString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignPermissionDto {
  @IsNumberString({}, { message: '用户ID格式错误' })
  @IsNotEmpty({ message: '用户ID不能为空' })
  userId!: string;

  @IsArray({ message: '社区ID列表必须为数组' })
  @IsNotEmpty({ message: '社区ID列表不能为空' })
  communityIds!: string[];
}

export class RemovePermissionDto {
  @IsNumberString({}, { message: '用户ID格式错误' })
  @IsNotEmpty({ message: '用户ID不能为空' })
  userId!: string;

  @IsArray({ message: '社区ID列表必须为数组' })
  communityIds!: string[];
}
