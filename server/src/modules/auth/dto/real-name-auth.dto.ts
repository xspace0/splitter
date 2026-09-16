import { IsString, IsNotEmpty } from 'class-validator';

export class RealNameAuthDto {
  @IsString()
  @IsNotEmpty()
  realName!: string;

  @IsString()
  @IsNotEmpty()
  idCard!: string;

  @IsString()
  @IsNotEmpty()
  province!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  district!: string;
}
