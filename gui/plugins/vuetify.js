import Vue from 'vue'
import Vuetify from 'vuetify/lib/framework'

// Import relevant styles and fonts
import 'vuetify/dist/vuetify.min.css'
import '@mdi/font/css/materialdesignicons.css'
import '@fontsource/roboto'

Vue.use( Vuetify )

export default new Vuetify( {
	theme: {
		dark: false,
		options: {
			customProperties: true,
			cspNonce: 'dQw4w9WgXcQ'
		}
	}
} )
