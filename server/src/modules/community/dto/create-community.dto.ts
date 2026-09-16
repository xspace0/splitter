import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateCommunityDto {
  @IsString()
  @IsNotEmpty({ message: '社区名称不能为空' })
  @MaxLength(100)
  communityName!: string;

  @IsOptional()
  @IsString()
  regionId?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
