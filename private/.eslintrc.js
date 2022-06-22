module.exports = {
	extends: [
		'eslint:recommended',
		'plugin:vue/recommended'
	],
	rules: {
		'vue/no-v-text-v-html-on-component': 'off',
		'vue/valid-v-slot': 'off',
		'no-unused-vars': 'off',
		'no-undef': 'off',
		'no-empty': 'off',
		'no-redeclare': 'off',
		'valid-typeof': 'off',
		'no-constant-condition': 'off',
		'no-useless-escape': 'off',
		'no-prototype-builtins': 'off',
		'no-cond-assign': 'off',
		'no-unreachable': 'off',
		'no-mixed-spaces-and-tabs': 'off'
	},
	parserOptions: {
		ecmaVersion: 13
	}
}