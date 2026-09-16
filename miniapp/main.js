import App from './App'
import request from './utils/request.js'
import auth from './api/auth.js'
import splitter from './api/splitter.js'
import community from './api/community.js'

const api = { auth, splitter, community };

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
Vue.prototype.$api = api
Vue.prototype.$request = request
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
	return {
		app
	}
}
// #endif
