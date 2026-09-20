import { IsInt, IsIn, IsOptional } from 'class-validator';

/** 分光器状态：1-正常 2-故障 3-停用 4-建设中 */
export const SPLITTER_STATUS_VALUES = [1, 2, 3, 4] as const;

/** 故障类型：1-无光 2-光大 3-箱体损坏 4-拆移改 */
export const FAULT_TYPE_VALUES = [1, 2, 3, 4] as const;

export class UpdateSplitterStatusDto {
  @IsInt({ message: '状态必须为数字' })
  @IsIn(SPLITTER_STATUS_VALUES, { message: '状态取值非法（1-正常 2-故障 3-停用 4-建设中）' })
  status!: number;

  @IsOptional()
  @IsInt({ message: '故障类型必须为数字' })
  @IsIn(FAULT_TYPE_VALUES, { message: '故障类型取值非法（1-无光 2-光大 3-箱体损坏 4-拆移改）' })
  faultType?: number;
}

export class ReportFaultDto {
  @IsInt({ message: '故障类型必须为数字' })
  @IsIn(FAULT_TYPE_VALUES, { message: '故障类型取值非法（1-无光 2-光大 3-箱体损坏 4-拆移改）' })
  faultType!: number;
}

export class UpdateSplitterLevelDto {
  @IsInt({ message: '设备级别必须为数字' })
  @IsIn([1, 2, 3, 4], { message: '设备级别取值非法（1-光交 2-一级 3-二级 4-光缆成端）' })
  splitterLevel!: number;
}
