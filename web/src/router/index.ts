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
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('@/views/UsersView.vue'),
    },
    {
      path: '/communities',
      name: 'communities',
      component: () => import('@/views/CommunitiesView.vue'),
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
