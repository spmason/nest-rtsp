const path = require( 'path' )
const fs = require( 'fs' )
const dot = require( 'dot-object' )

const expts = Object.assign( ...fs.readdirSync( path.join( __dirname ) ).filter( n => {
	const providerPath = path.join( __dirname, n )
	return ( fs.lstatSync( providerPath ).isDirectory() || ( n.endsWith( '.js' ) && 'index.js' !== n ) )
} ).map( n => {
	const providerPath = path.join( __dirname, n )
	const key = n.replace( /\.js$/gm, '' )
	return { [key]: require( providerPath ) }
} ) )

const getFromExpts = path => {
	return dot.pick( path, expts )
}

const proxyHandler = {
	get( target, prop ) {
		if ( 'get' === prop ) {
			return getFromExpts.bind( null )
		}
		return Reflect.get( ...arguments )
	},

	set() {
		// do nothing
	}
}

module.exports = new Proxy( expts, proxyHandler )