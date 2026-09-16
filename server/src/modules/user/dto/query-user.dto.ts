import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryUserDto extends PaginationDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  roleType?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  status?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  regionId?: number;
}
