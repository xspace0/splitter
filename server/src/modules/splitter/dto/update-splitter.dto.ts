import {
  IsString,
  IsOptional,
  MaxLength,
  IsInt,
} from 'class-validator';

export class UpdateSplitterDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  splitterName?: string;

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
  @IsString()
  remark?: string;
}
