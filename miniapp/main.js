import App from './App'
import CustomTabbar from './components/custom-tabbar/index.vue'
import request from './utils/request.js'
import * as auth from './api/auth.js'
import * as splitter from './api/splitter.js'
import * as community from './api/community.js'

const api = { auth, splitter, community };

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
Vue.prototype.$api = api
Vue.prototype.$request = request
// pages.json 声明了自定义 tabBar，需全局注册该组件
Vue.component('custom-tabbar', CustomTabbar)
App.mpType = 'app'
const app = new Vue({
	...App
})
app.$mount()
// #endif

// #ifdef VUE3
import {
	createSSRApp
} from 'vue'
export function createApp() {
	const app = createSSRApp(App)
	app.config.globalProperties.$api = api
	app.config.globalProperties.$request = request
	// pages.json 声明了自定义 tabBar，需全局注册该组件
	app.component('custom-tabbar', CustomTabbar)
	return {
		app
	}
}
// #endif
