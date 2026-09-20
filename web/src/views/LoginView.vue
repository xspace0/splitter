<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="title">分光器资源管理系统</h1>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>账号</label>
          <input v-model="form.account" type="text" placeholder="请输入账号" autocomplete="username" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="form.password" type="password" placeholder="请输入密码" autocomplete="current-password" />
        </div>
        <p v-if="error" class="error-msg">{{ error }}</p>
        <button type="submit" class="btn-login" :disabled="loading">
          {{ loading ? '登录中...' : '登 录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '@/api/auth';
import { setToken, setProfileCache } from '@/utils/auth';

const router = useRouter();
const loading = ref(false);
const error = ref('');
const form = reactive({ account: '', password: '' });

async function handleLogin() {
  error.value = '';
  if (!form.account || !form.password) {
    error.value = '请输入账号和密码';
    return;
  }
  loading.value = true;
  try {
    const res = await login({ account: form.account, password: form.password });
    setToken(res.data.token);
    setProfileCache({
      id: res.data.user.id,
      account: res.data.user.account || '',
      username: res.data.user.username,
      roleType: res.data.user.roleType,
      realNameVerified: res.data.user.realNameVerified,
      regionId: res.data.user.regionId || '',
    });
    // 文档 4.6.1 / 5.2：已实名认证用户登录后默认进入地图页面
    router.push(res.data.user.realNameVerified ? '/map' : '/profile');
  } catch (e: any) {
    const msg = e.response?.data?.message;
    error.value = msg || '登录失败，请重试';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1890ff 0%, #0050b3 100%);
}
.login-card {
  width: 380px;
  padding: 40px 32px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}
.title {
  text-align: center;
  font-size: 22px;
  color: #333;
  margin: 0 0 32px;
}
.form-group {
  margin-bottom: 20px;
}
.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: #555;
}
.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.form-group input:focus {
  border-color: #1890ff;
  outline: none;
}
.error-msg {
  color: #e74c3c;
  font-size: 13px;
  margin: 0 0 12px;
}
.btn-login {
  width: 100%;
  padding: 12px;
  background: #1890ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-login:hover:not(:disabled) {
  background: #096dd9;
}
.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

