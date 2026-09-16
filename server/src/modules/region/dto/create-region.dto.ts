import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateRegionDto {
  @IsString()
  @IsNotEmpty()
  regionName!: string;

  @IsOptional()
  parentId?: string;

  @IsInt()
  @Min(1)
  regionLevel!: number;

  @IsOptional()
  @IsString()
  regionCode?: string;
}
