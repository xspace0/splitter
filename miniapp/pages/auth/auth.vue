<template>
  <view class="auth-page">
    <view class="auth-notice">
      <text class="notice-icon">ℹ️</text>
      <view class="notice-text">
        <text class="notice-title">请完成实名认证</text>
        <text class="notice-desc">未实名认证用户仅可访问「我的」页面，完成认证后方可使用地图、故障上报等功能。</text>
      </view>
    </view>

    <view class="form-card">
      <view class="form-group">
        <label><text class="required">*</text> 真实姓名</label>
        <input v-model="form.realName" class="form-input" placeholder="请输入真实姓名" />
      </view>
      <view class="form-group">
        <label><text class="required">*</text> 身份证号</label>
        <input v-model="form.idCard" class="form-input" placeholder="请输入身份证号" />
      </view>
      <view class="form-group">
        <label><text class="required">*</text> 所属地区</label>
        <view class="region-row">
          <picker :range="provinces" @change="onProvinceChange" class="region-picker">
            <view class="picker-value">{{ form.province || '请选择' }}</view>
          </picker>
          <picker :range="cities" @change="onCityChange" class="region-picker">
            <view class="picker-value">{{ form.city || '请选择' }}</view>
          </picker>
          <picker :range="districts" @change="onDistrictChange" class="region-picker">
            <view class="picker-value">{{ form.district || '请选择' }}</view>
          </picker>
        </view>
      </view>
      <button class="btn btn-primary btn-submit" @click="handleSubmit" :disabled="submitting">
        {{ submitting ? '提交中...' : '提交认证' }}
      </button>
    </view>

    <view class="auth-tips">
      <view class="tips-title">📌 认证说明：</view>
      <view class="tips-item">1. 提交后后端校验姓名与身份证号，通过后置为已认证</view>
      <view class="tips-item">2. 单用户每日最多提交5次</view>
      <view class="tips-item">3. 身份证号加密存储，仅授权管理岗位可解密查看</view>
      <view class="tips-item">4. 认证成功后可访问全部已授权页面</view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      form: {
        realName: '',
        idCard: '',
        province: '',
        city: '',
        district: '',
      },
      submitting: false,
      provinces: ['北京市', '上海市', '天津市', '重庆市', '河北省', '河南省'],
      cities: ['市辖区'],
      districts: ['延庆区', '海淀区', '朝阳区', '东城区', '西城区'],
    };
  },
  methods: {
    onProvinceChange(e) {
      this.form.province = this.provinces[e.detail.value];
      this.form.city = '';
      this.form.district = '';
    },
    onCityChange(e) {
      this.form.city = this.cities[e.detail.value];
      this.form.district = '';
    },
    onDistrictChange(e) {
      this.form.district = this.districts[e.detail.value];
    },
    async handleSubmit() {
      if (!this.form.realName.trim()) {
        uni.showToast({ title: '请输入真实姓名', icon: 'none' });
        return;
      }
      if (!this.form.idCard.trim()) {
        uni.showToast({ title: '请输入身份证号', icon: 'none' });
        return;
      }
      if (!this.form.province || !this.form.city || !this.form.district) {
        uni.showToast({ title: '请选择所属地区', icon: 'none' });
        return;
      }
      this.submitting = true;
      try {
        const res = await this.$api.auth.submitRealName({
          realName: this.form.realName,
          idCard: this.form.idCard,
          province: this.form.province,
          city: this.form.city,
          district: this.form.district,
        });
        uni.showToast({ title: '认证成功', icon: 'success' });
        // 保存新token（包含更新后的认证状态和regionId）
        if (res.data.token) {
          uni.setStorageSync('token', res.data.token);
        }
        // 更新本地profile
        const profile = uni.getStorageSync('profile') || {};
        profile.realNameVerified = 1;
        profile.username = this.form.realName;
        if (res.data.user?.regionId) {
          profile.regionId = res.data.user.regionId;
        }
        uni.setStorageSync('profile', profile);
        setTimeout(() => {
          // 认证成功后跳转到地图页
          uni.switchTab({ url: '/pages/map/map' });
        }, 1000);
      } catch (e) {
        // 失败已弹过toast
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style>
.auth-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 32rpx;
}
.auth-notice {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 28rpx;
  background: #e6f7ff;
  margin: 20rpx;
  border-radius: 8rpx;
}
.notice-icon {
  font-size: 32rpx;
  flex-shrink: 0;
}
.notice-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.notice-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #1890ff;
}
.notice-desc {
  font-size: 24rpx;
  color: #666;
  line-height: 1.6;
}
.form-card {
  background: #fff;
  margin: 0 20rpx;
  border-radius: 8rpx;
  padding: 32rpx;
}
.region-row {
  display: flex;
  gap: 16rpx;
}
.region-picker {
  flex: 1;
  border: 1rpx solid #e8e8e8;
  border-radius: 8rpx;
  padding: 16rpx 20rpx;
  background: #fff;
  font-size: 26rpx;
}
.picker-value {
  color: #333;
}
.btn-submit {
  width: 100%;
  margin-top: 16rpx;
  border-radius: 40rpx;
}
.auth-tips {
  padding: 24rpx 32rpx;
  font-size: 24rpx;
  color: #999;
  line-height: 1.8;
}
.tips-title {
  margin-bottom: 8rpx;
  color: #666;
}
.tips-item {
  padding-left: 20rpx;
}
</style>
