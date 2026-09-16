import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsInt,
  IsNumberString,
} from 'class-validator';

export class CreateSplitterDto {
  @IsString()
  @IsNotEmpty({ message: '分光器名称不能为空' })
  @MaxLength(128)
  splitterName!: string;

  @IsNumberString({}, { message: '社区ID格式错误' })
  @IsNotEmpty({ message: '社区ID不能为空' })
  communityId!: string;

  @IsInt({ message: '分光器级别必须是数字' })
  @IsNotEmpty({ message: '分光器级别不能为空' })
  splitterLevel!: number;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  splitRatio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  installLocation?: string;

  @IsOptional()
  @IsString()
  longitude?: string;

  @IsOptional()
  @IsString()
  latitude?: string;

  @IsOptional()
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}
