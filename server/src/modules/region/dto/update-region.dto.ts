import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateRegionDto {
  @IsOptional()
  @IsString()
  regionName?: string;

  @IsOptional()
  @IsString()
  regionCode?: string;
}
