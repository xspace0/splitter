import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateCommunityDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  communityName?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
