import { IsString, IsOptional, IsPhoneNumber, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  username?: string;

  @IsOptional()
  @IsString()
  @IsPhoneNumber('CN')
  phone?: string;

  @IsOptional()
  @IsString()
  idCardNo?: string;
}
