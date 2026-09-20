import { IsNumberString, IsNotEmpty, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class AssignPermissionDto {
  @IsNumberString({}, { message: '用户ID格式错误' })
  @IsNotEmpty({ message: '用户ID不能为空' })
  userId!: string;

  @IsArray({ message: '社区ID列表必须为数组' })
  @IsNotEmpty({ message: '社区ID列表不能为空' })
  communityIds!: string[];

  /**
   * 社区已归属其他操作员时，是否强制改派（原记录置为已移除）。
   * 不传则返回冲突提示，由调用方确认后再改派。
   */
  @IsOptional()
  @IsBoolean({ message: 'force 必须为布尔值' })
  force?: boolean;
}

export class RemovePermissionDto {
  @IsNumberString({}, { message: '用户ID格式错误' })
  @IsNotEmpty({ message: '用户ID不能为空' })
  userId!: string;

  @IsArray({ message: '社区ID列表必须为数组' })
  communityIds!: string[];
}
