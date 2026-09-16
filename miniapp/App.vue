<script>
import auth from './api/auth.js';
import splitter from './api/splitter.js';
import community from './api/community.js';

export default {
  onLaunch() {
    console.log('App Launch');
    // 全局注入API
    uni.$api = { auth, splitter, community };
  },
  onShow() {
    console.log('App Show');
  },
  onHide() {
    console.log('App Hide');
  },
};
</script>

<style>
/*每个页面公共css */
</style>
