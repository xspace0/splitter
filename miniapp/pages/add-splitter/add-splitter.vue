<template>
  <view class="add-page">
    <!-- 基本信息 -->
    <view class="form-section">
      <view class="section-title">基本信息</view>
      <view class="form-group">
        <label>设备名称 <text class="required">*</text></label>
        <input v-model="form.splitterName" class="form-input" placeholder="请输入设备名称" />
      </view>
      <view class="form-group">
        <label>所属社区 <text class="required">*</text></label>
        <picker :range="communityOptions" range-key="label" @change="onCommunityChange">
          <view class="picker-value">{{ selectedCommunityLabel }} <text class="arrow">▾</text></view>
        </picker>
        <view class="form-tip">仅显示您有权限操作的社区</view>
      </view>
      <view class="form-group">
        <label>设备级别 <text class="required">*</text></label>
        <picker :range="levelOptions" range-key="label" @change="onLevelChange">
          <view class="picker-value">{{ selectedLevelLabel }} <text class="arrow">▾</text></view>
        </picker>
        <view class="form-tip">光交由管理员统一维护</view>
      </view>
      <view class="form-group">
        <label>父级设备 <text class="required">*</text></label>
        <picker :range="parentOptions" range-key="label" @change="onParentChange" :disabled="parentOptions.length === 0">
          <view class="picker-value">{{ selectedParentLabel }} <text class="arrow">▾</text></view>
        </picker>
        <view class="form-tip">一级分光器父级为光交；二级为一级；成端为二级</view>
      </view>
    </view>

    <!-- 设备参数 -->
    <view class="form-section">
      <view class="section-title">设备参数</view>
      <view class="form-group">
        <label>分路比</label>
        <picker :range="ratioOptions" @change="onRatioChange">
          <view class="picker-value">{{ form.splitRatio || '请选择分路比' }} <text class="arrow">▾</text></view>
        </picker>
      </view>
      <view class="form-group">
        <label>安装位置</label>
        <input v-model="form.installLocation" class="form-input" placeholder="请输入安装位置" />
      </view>
      <view class="form-group">
        <label>经度 / 纬度</label>
        <view class="geo-row">
          <input :value="form.longitude" class="form-input geo-input readonly" readonly placeholder="自动获取" />
          <input :value="form.latitude" class="form-input geo-input readonly" readonly placeholder="自动获取" />
        </view>
        <view class="geo-tip" v-if="form.longitude">📍 已自动获取当前位置</view>
        <view class="geo-tip" v-else style="color:#999;">⏳ 正在获取位置...</view>
      </view>
      <view class="form-group" style="margin-bottom: 0;">
        <label>备注</label>
        <textarea v-model="form.remark" class="form-textarea" placeholder="选填，其他需要说明的信息"></textarea>
      </view>
    </view>

    <!-- 提示 -->
    <view class="tip-box tip-warning">
      <text class="tip-title">注意：</text>
      <view class="tip-item">1. 父级设备必须与新设备归属同一社区</view>
      <view class="tip-item">2. 社区停用状态下不允许新增设备</view>
      <view class="tip-item">3. 设备名称在社区内不可重复</view>
    </view>

    <!-- 提交按钮 -->
    <view class="submit-bar">
      <button class="btn btn-primary btn-submit" @click="handleSubmit" :disabled="submitting">
        {{ submitting ? '提交中...' : '提交新增' }}
      </button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      form: {
        splitterName: '',
        communityId: '',
        splitterLevel: '',
        parentId: '',
        splitRatio: '',
        installLocation: '',
        longitude: '',
        latitude: '',
        remark: '',
      },
      submitting: false,
      communities: [],
      communityOptions: [{ value: '', label: '请选择社区' }],
      levelOptions: [
        { value: 2, label: '一级分光器' },
        { value: 3, label: '二级分光器' },
        { value: 4, label: '光缆成端' },
      ],
      parentOptions: [{ value: '', label: '请选择父级设备' }],
      ratioOptions: ['1:4', '1:8', '1:16', '1:32', '1:64'],
    };
  },
  computed: {
    selectedCommunityLabel() {
      const o = this.communityOptions.find(c => c.value === this.form.communityId);
      return o ? o.label : '请选择社区';
    },
    selectedLevelLabel() {
      const o = this.levelOptions.find(l => String(l.value) === String(this.form.splitterLevel));
      return o ? o.label : '请选择设备级别';
    },
    selectedParentLabel() {
      const o = this.parentOptions.find(p => p.value === this.form.parentId);
      return o ? o.label : '请选择父级设备';
    },
  },
  onLoad() {
    this.loadCommunities();
    this.getLocation();
  },
  methods: {
    async loadCommunities() {
      try {
        const res = await this.$api.community.getCommunities({ page: 1, pageSize: 100 });
        this.communities = res.data.list;
        this.communityOptions = [
          { value: '', label: '请选择社区' },
          ...res.data.list.filter(c => c.status === 1).map(c => ({ value: c.id, label: c.communityName })),
        ];
      } catch (e) { console.error(e); }
    },
    onCommunityChange(e) {
      const idx = e.detail.value;
      this.form.communityId = this.communityOptions[idx].value;
      this.form.parentId = '';
      this.loadParentOptions();
    },
    onLevelChange(e) {
      const idx = e.detail.value;
      this.form.splitterLevel = this.levelOptions[idx].value;
      this.form.parentId = '';
      this.loadParentOptions();
    },
    onParentChange(e) {
      const idx = e.detail.value;
      this.form.parentId = this.parentOptions[idx].value;
    },
    onRatioChange(e) {
      this.form.splitRatio = this.ratioOptions[e.detail.value];
    },
    async loadParentOptions() {
      if (!this.form.communityId || !this.form.splitterLevel) {
        this.parentOptions = [{ value: '', label: '请选择父级设备' }];
        return;
      }
      const parentLevel = this.form.splitterLevel - 1;
      if (parentLevel < 1) {
        this.parentOptions = [{ value: '', label: '请选择父级设备' }];
        return;
      }
      try {
        const res = await this.$api.splitter.getSplitters({
          communityId: this.form.communityId,
          splitterLevel: parentLevel,
          status: 1,
          page: 1,
          pageSize: 100,
        });
        const levelNames = { 1: '光交', 2: '一级分光器', 3: '二级分光器' };
        this.parentOptions = [
          { value: '', label: '请选择父级设备' },
          ...res.data.list.map(s => ({ value: s.id, label: `${s.splitterName}（${levelNames[parentLevel]}）` })),
        ];
      } catch (e) { console.error(e); }
    },
    getLocation() {
      uni.getLocation({
        type: 'gcj02',
        success: (res) => {
          this.form.longitude = res.longitude.toFixed(6);
          this.form.latitude = res.latitude.toFixed(6);
        },
        fail: () => {
          // 获取失败也不影响提交
        },
      });
    },
    async handleSubmit() {
      if (!this.form.splitterName.trim()) {
        uni.showToast({ title: '请输入设备名称', icon: 'none' });
        return;
      }
      if (!this.form.communityId) {
        uni.showToast({ title: '请选择所属社区', icon: 'none' });
        return;
      }
      if (!this.form.splitterLevel) {
        uni.showToast({ title: '请选择设备级别', icon: 'none' });
        return;
      }
      if (!this.form.parentId) {
        uni.showToast({ title: '请选择父级设备', icon: 'none' });
        return;
      }
      this.submitting = true;
      try {
        const data = { ...this.form };
        if (!data.splitRatio) delete data.splitRatio;
        if (!data.installLocation) delete data.installLocation;
        if (!data.remark) delete data.remark;
        await this.$api.splitter.createSplitter(data);
        uni.showToast({ title: '新增成功', icon: 'success' });
        setTimeout(() => {
          uni.navigateBack();
        }, 1000);
      } catch (e) {
        // 已弹过toast
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style>
.add-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 120rpx;
}
.form-section {
  background: #fff;
  margin: 24rpx;
  border-radius: 8rpx;
  overflow: hidden;
}
.section-title {
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid #f5f5f5;
  font-size: 28rpx;
  font-weight: 500;
}
.form-group {
  padding: 24rpx 32rpx;
  margin-bottom: 0;
}
.form-group label {
  display: block;
  margin-bottom: 16rpx;
  font-size: 26rpx;
  color: #666;
}
.required {
  color: #ff4d4f;
}
.form-input {
  width: 100%;
  padding: 20rpx 24rpx;
  border: 1rpx solid #e8e8e8;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}
.form-textarea {
  width: 100%;
  padding: 20rpx 24rpx;
  border: 1rpx solid #e8e8e8;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  min-height: 120rpx;
}
.picker-value {
  width: 100%;
  padding: 20rpx 24rpx;
  border: 1rpx solid #e8e8e8;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #333;
}
.arrow {
  color: #999;
  font-size: 24rpx;
}
.form-tip {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}
.geo-row {
  display: flex;
  gap: 16rpx;
}
.geo-input {
  flex: 1;
}
.geo-input.readonly {
  background: #f5f5f5;
  color: #666;
}
.geo-tip {
  font-size: 22rpx;
  color: #07c160;
  margin-top: 8rpx;
}

.tip-box {
  margin: 16rpx 24rpx;
  padding: 20rpx 24rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  line-height: 1.8;
}
.tip-warning {
  background: #fff7e6;
  border: 1rpx solid #ffd591;
  color: #fa8c16;
}
.tip-title {
  font-weight: 500;
  margin-bottom: 4rpx;
}

.submit-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.05);
}
.btn-submit {
  width: 100%;
  border-radius: 40rpx;
}
.btn-primary {
  background: #07c160;
  color: #fff;
}
.btn-primary:disabled {
  opacity: 0.6;
}
</style>
