import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_KEY = 'allowUnverified';

/**
 * 标记该接口允许未实名认证用户访问
 * （默认所有已登录接口都要求实名认证，除非显式标记）
 */
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true);
