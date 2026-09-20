import { createRouter, createWebHistory } from 'vue-router';
import { getToken, getProfileCache } from '@/utils/auth';

// 角色等级：数字越小权限越高
const ROLE_LEVEL: Record<string, number> = {
  SUPER_ADMIN: 1,
  REGION_ADMIN: 2,
  ADMIN: 3,
  OPERATOR: 4,
  VIEWER: 5,
};

// 路由权限配置：允许访问的最高角色等级（含）
const ROUTE_ROLES: Record<string, string[]> = {
  home: ['SUPER_ADMIN', 'REGION_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER'],
  splitters: ['SUPER_ADMIN', 'REGION_ADMIN', 'ADMIN', 'OPERATOR'],
  map: ['SUPER_ADMIN', 'REGION_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER'],
  communities: ['SUPER_ADMIN', 'REGION_ADMIN', 'ADMIN'],
  users: ['SUPER_ADMIN', 'REGION_ADMIN', 'ADMIN'],
  permissions: ['SUPER_ADMIN', 'ADMIN'],
  logs: ['SUPER_ADMIN'],
  regions: ['SUPER_ADMIN', 'REGION_ADMIN', 'ADMIN'],
  profile: ['SUPER_ADMIN', 'REGION_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER'],
};

// 不需要实名认证的页面
const NO_VERIFY_ROUTES = ['login', 'profile'];

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
        },
        {
          path: 'splitters',
          name: 'splitters',
          component: () => import('@/views/SplittersView.vue'),
        },
        {
          path: 'map',
          name: 'map',
          component: () => import('@/views/MapView.vue'),
        },
        {
          path: 'communities',
          name: 'communities',
          component: () => import('@/views/CommunitiesView.vue'),
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/UsersView.vue'),
        },
        {
          path: 'permissions',
          name: 'permissions',
          component: () => import('@/views/PermissionsView.vue'),
        },
        {
          path: 'logs',
          name: 'logs',
          component: () => import('@/views/LogsView.vue'),
        },
        {
          path: 'regions',
          name: 'regions',
          component: () => import('@/views/RegionsView.vue'),
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const token = getToken();

  // 未登录
  if (!token && to.name !== 'login') {
    return { name: 'login' };
  }
  if (token && to.name === 'login') {
    return { name: 'home' };
  }

  if (!token) return true;

  // 从缓存读取用户信息
  const profile = getProfileCache();
  if (!profile) return true; // 没有缓存先放行，页面内会拉取

  const routeName = to.name as string;

  // 角色权限校验
  const allowedRoles = ROUTE_ROLES[routeName];
  if (allowedRoles && !allowedRoles.includes(profile.roleType)) {
    // 无权限，跳首页
    return { name: 'home' };
  }

  // 实名认证校验（个人中心和登录页除外）
  if (!NO_VERIFY_ROUTES.includes(routeName)) {
    if (!profile.realNameVerified) {
      return { name: 'profile', query: { reason: 'unverified' } };
    }
  }
});

export default router;
export { ROUTE_ROLES, ROLE_LEVEL };
