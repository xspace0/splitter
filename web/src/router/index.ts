import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '@/utils/auth';

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
  if (!token && to.name !== 'login') {
    return { name: 'login' };
  }
  if (token && to.name === 'login') {
    return { name: 'home' };
  }
});

export default router;
