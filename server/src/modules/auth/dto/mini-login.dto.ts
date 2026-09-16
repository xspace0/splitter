import { IsString, IsNotEmpty } from 'class-validator';

export class MiniLoginDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
