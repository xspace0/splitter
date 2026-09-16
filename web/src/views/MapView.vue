<template>
  <div class="map-container">
    <div class="page-header">
      <h2>地图查看</h2>
    </div>
    <div class="map-placeholder">
      <div class="map-grid"></div>
      <div class="map-tip">
        <p style="font-size: 16px; color: #999; margin-bottom: 8px;">地图功能开发中</p>
        <p style="font-size: 13px; color: #bbb;">将展示分光器设备分布、状态标记、连接线路等</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.map-container {
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
.map-placeholder {
  width: 100%;
  height: calc(100vh - 120px);
  background: linear-gradient(135deg, #e8f4f8 0%, #d1e8e5 100%);
  border-radius: 8px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.map-grid {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: linear-gradient(rgba(24, 144, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(24, 144, 255, 0.08) 1px, transparent 1px);
  background-size: 40px 40px;
}
.map-tip {
  position: relative;
  z-index: 1;
  text-align: center;
}
</style>
