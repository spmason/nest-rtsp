import Vue from 'vue'
import Notifications from 'vue-notification'
import App from './app.vue'
import vuetify from './plugins/vuetify'
import api from './plugins/api'
Vue.config.productionTip = false
Vue.use( Notifications )
Vue.use( api )
const app = new Vue( {
	vuetify,
	render: h => h( App )
} ).$mount( '#app' )

window.$app = app
