const mixr = require( 'laravel-mix' )
require( 'mix-html-builder' )
require( 'laravel-mix-versionhash' )
require( 'vuetifyjs-mix-extension' )
require( 'laravel-mix-polyfill' )
mixr.disableNotifications()
	.setPublicPath( './public' )
	.extract( [ 'vue', 'vuetify', 'socket.io-client', '@mdi/font', 'shortid' ] )
	.js( 'gui/app.js', './public' ).vuetify( 'vuetify-loader' ).vue( { version: 2 } ).sourceMaps()
	.sass( 'gui/app.scss', './public' ).vuetify( 'vuetify-loader' ).vue( { version: 2 } )
	.html( { htmlRoot: 'gui/index.html', output: './', inject: true } )
if ( 'development' !== process.env.NODE_ENV ) {
	mixr.versionHash()
}