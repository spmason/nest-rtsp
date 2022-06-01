module.exports = {
	extends: [
		'eslint:recommended',
		'plugin:vue/recommended' // Use this if you are using Vue.js 2.x.
	],
	rules: {
		'vue/no-v-text-v-html-on-component': 'off',
		'vue/valid-v-slot': 'off'
	},
	parserOptions: {
		ecmaVersion: 13
	}
}