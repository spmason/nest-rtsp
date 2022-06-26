#!/usr/bin/env node

/**
 * This is a special command which is used when launching in docker
 * It first runs the relevant database migrations, and then launches the server
 */
const path = require( 'path' )
const { fork } = require( 'child_process' )
const clc = require( 'cli-color' )

const run = async () => {
	// Check that we have all required variables
	console.log( clc.cyan( 'Checking requirements' ) )
	const required = [
		'GA_OAUTH_CID',
		'GA_OAUTH_CS',
		'GA_SDM_PID',
		'GA_OAUTH_RDR'
	]
	for ( let i = 0; i < required.length; i++ ) {
		const property = required[i]
		if ( 'string' !== typeof process.env[property] || 0 === process.env[property].trim().length ) {
			throw new Error( `Missing required ENV "${property}"` )
		}
	}
	// Run database migrations
	console.log( clc.cyan( 'Running Database Migrations' ) )
	await new Promise( ( resolve, reject ) => {
		const migrations = fork( './node_modules/.bin/knex', [ 'migrate:latest' ], {
			cwd: path.join( __dirname )
		} )
		migrations.on( 'exit', code => {
			if ( 0 === code ) {
				resolve( code )
			}
			else {
				reject( new Error( 'Migration Failed' ) )
			}
		} )
		if ( migrations.stdout ) {
			migrations.stdout.pipe( process.stdout )
		}
		if ( migrations.stderr ) {
			migrations.stderr.pipe( process.stderr )
		}
	} )
	// Launch Server
	console.log( clc.cyan( 'Launching Server' ) )
	const server = fork( './server.js', [], {
		cwd: path.join( __dirname ),
		env: { ...process.env, containerized: true }
	} )
	server.on( 'exit', code => {
		process.exit( code )
	} )
	if ( server.stdout ) {
		server.stdout.pipe( process.stdout )
	}
	if ( server.stderr ) {
		server.stderr.pipe( process.stderr )
	}
}

run().then( () => {
	console.log( clc.greenBright( 'Nest RTSP Server is Running' ) )
} ).catch( error => {
	console.error( clc.redBright( error.message ) )
	const lines = error.stack.split( '\n' ).map( l => l.trim() )
	let i = 1
	let lined = false
	while ( i < lines.length && !lined ) {
		if ( !lined ) {
			lined = lines[i].includes( ':' )
		}
		console.error( clc.redBright( lines[i] ) )
		i ++
	}
	process.exit( 1 )

} )