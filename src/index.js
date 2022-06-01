const path = require( 'path' )
// const { inspect } = require( 'util' )
/**
 * Load all configuration information from the elevant .env files
 */
require( 'dotenv' ).config( { override: true } )

const BASE = path.join( __dirname, '..' )
process.env.BASE = BASE

/**
 * Auto-load all providers
 */
const fs = require( 'fs' )
const providers = Object.assign( {}, ...fs.readdirSync( path.join( BASE, 'src', 'providers' ) ).map( n => {
	const providerPath = path.join( BASE, 'src', 'providers', n )
	return { [n]: require( providerPath ) }
} ) )
const controllers = Object.assign( {}, ...fs.readdirSync( path.join( BASE, 'src', 'controllers' ) ).map( n => {
	const providerPath = path.join( BASE, 'src', 'controllers', n )
	return { [n]: require( providerPath ) }
} ) )

module.exports = { providers, controllers }