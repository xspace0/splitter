<template>
  <div class="logs-container">
    <div class="page-header">
      <h2>操作日志</h2>
    </div>
    <div class="empty-state">
      <p style="font-size: 16px; color: #999; margin-bottom: 8px;">审计日志模块开发中</p>
      <p style="font-size: 13px; color: #bbb;">将记录所有用户的操作行为，包括增删改查、权限变更等</p>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.logs-container {
  min-height: 100vh;
  background: #f0f2f5;
  padding: 20px 24px;
}
.page-header {
  margin-bottom: 16px;
}
.page-header h2 {
  font-size: 18px;
  color: #333;
  margin: 0;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
}
</style>
