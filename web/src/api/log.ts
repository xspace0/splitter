import request from '@/utils/request';

export interface LogItem {
  id: string;
  userId: string;
  username: string;
  account: string;
  operationType: string;
  targetType: string;
  targetId: string | null;
  operationContent: string | null;
  ip: string | null;
  userAgent: string | null;
  createTime: string;
}

export function getLogs(params: {
  operationType?: string;
  targetType?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) {
  return request.get<{
    code: number;
    data: { list: LogItem[]; total: number; page: number; pageSize: number };
  }>('/logs', { params });
}
