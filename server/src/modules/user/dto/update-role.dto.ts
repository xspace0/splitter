import { IsNotEmpty, IsEnum } from 'class-validator';
import { RoleType } from '@/common/enums/role.enum';

export class UpdateRoleDto {
  @IsEnum(RoleType, { message: '角色类型不合法' })
  @IsNotEmpty({ message: '角色不能为空' })
  roleType!: RoleType;
}
