const express = require( 'express' )
const http = require( 'http' )
const path = require( 'path' )
const fs = require( 'fs' )
const { Server:sio } = require( 'socket.io' )
const EventEmitter = require( 'events' )
const shortid = require( 'shortid' )
const debug = require( 'debug' )

const dbg = debug( 'nest-rtsp:http' )

class HTTP_Server extends EventEmitter {
	#port
	#app
	#server
	#io

	constructor( port ) {
		super()
		this.#port = port
		this.#app = express()
		this.#server = http.createServer( this.#app )
		this.#io = new sio( this.#server )
		// Setup Routing
		this.#app.get( '/', async ( req, res ) => {
			const { code, scope, authuser } = req.query
			if ( code, scope, authuser ) {
				const id = shortid.generate()
				const timeout = 10000
				const cmd = 'handleOauthResponse'
				const args = req.query
				try {
					const resp = new Promise( ( resolve, reject ) => {
						this.once( `response-${id}`, resolve )
						this.once( `error-${id}`, reject )
					} )
					const racer = [ resp ]
					this.emit( 'request', { id, cmd, args } )
					if ( 'undefined' !== typeof timeout && 0 < parseInt( timeout ) ) {
						racer.push( new Promise( ( resolve, reject ) => {
							setTimeout( reject, timeout, new Error( 'Process Timeout' ) )
						} ) )
					}
					await Promise.race( racer ).catch( err => {
						throw err
					} )
				}
				catch ( error ) {
					if ( error && error.message ) {
						console.log( `Failed to process Google Authentication due to error: ${error.message}` )
					}
					else {
						console.log( 'Failed to process Google Authentication due to unknown error', error )
					}
					// do nothing
				}
			}
			res.sendFile( path.join( process.env.BASE, 'public', 'index.html' ) )
		} )
		this.#app.get( '/private', async ( req, res ) => {
			if ( [ '::1', '127.0.0.1', '::ffff:127.0.0.1' ].includes( req.ip ) ) {
				res.sendFile( path.join( process.env.BASE, 'private', 'index.html' ) )
			}
			else {
				dbg( `Got request from ip "${req.ip}"` )
				res.sendFile( path.join( process.env.BASE, 'public', 'index.html' ) )
			}
		} )
		this.#app.get( '/private/*', async ( req, res ) => {
			if ( [ '::1', '127.0.0.1', '::ffff:127.0.0.1' ].includes( req.ip ) ) {
				const rrpath = req.url.replace( '/private/', '' )
				const rpath = path.join( process.env.BASE, 'private', ( 0 === rrpath.length ) ? 'index.html' : rrpath )
				if ( fs.existsSync( rpath ) ) {
					res.sendFile( rpath )
				}
				else {
					res.sendFile( path.join( process.env.BASE, 'private', 'index.html' ) )
				}
			}
			else {
				dbg( `Got request from ip "${req.ip}"` )
				res.sendFile( path.join( process.env.BASE, 'public', 'index.html' ) )
			}
		} )
		this.#app.get( '/auth', async ( req, res ) => {
			if ( [ '::1', '127.0.0.1', '::ffff:127.0.0.1' ].includes( req.ip ) ) {
				res.sendFile( path.join( process.env.BASE, 'private', 'index.html' ) )
			}
			else {
				dbg( `Got request from ip "${req.ip}"` )
				res.sendFile( path.join( process.env.BASE, 'public', 'index.html' ) )
			}
		} )
		this.#app.get( '/auth/*', async ( req, res ) => {
			if ( [ '::1', '127.0.0.1', '::ffff:127.0.0.1' ].includes( req.ip ) ) {
				const rrpath = req.url.replace( '/auth/', '' )
				const rpath = path.join( process.env.BASE, 'private', ( 0 === rrpath.length ) ? 'index.html' : rrpath )
				if ( fs.existsSync( rpath ) ) {
					res.sendFile( rpath )
				}
				else {
					res.sendFile( path.join( process.env.BASE, 'private', 'index.html' ) )
				}
			}
			else {
				dbg( `Got request from ip "${req.ip}"` )
				res.sendFile( path.join( process.env.BASE, 'public', 'index.html' ) )
			}
		} )
		this.#app.use( express.static( path.join( process.env.BASE, 'public' ) ) )
		this.#app.get( '*', ( req, res ) => {
			res.sendFile( path.join( process.env.BASE, 'public', 'index.html' ) )
		} )
		this.#io.on( 'connection', this.#onConnection.bind( this ) )
	}

	async start() {
		return await new Promise( resolve => {
			const port = parseInt( this.#port )
			this.#server.listen( port, () => {
				resolve( { port, server: this } )
			} )
		} )
	}

	broadcast() {
		return this.#io.emit( ...arguments )
	}

	#onConnection = function( socket ) {
		socket.on( 'request', async ( { id, cmd, args, timeout } ) => {
			try {
				const resp = new Promise( ( resolve, reject ) => {
					this.once( `response-${id}`, resolve )
					this.once( `error-${id}`, reject )
				} )
				const racer = [ resp ]
				this.emit( 'request', { id, cmd, args } )
				if ( 'undefined' !== typeof timeout && 0 < parseInt( timeout ) ) {
					racer.push( new Promise( ( resolve, reject ) => {
						setTimeout( reject, timeout, new Error( 'Process Timeout' ) )
					} ) )
				}
				const res = await Promise.race( racer ).catch( err => {
					throw err
				} )
				socket.emit( `response-${id}`, res )
			}
			catch ( err ) {
				socket.emit( `error-${id}`, err ? err.message : 'an unknown error has occured' )
			}
		} )
	}

	static async init( port ) {
		const obj = new this( port )
		return await obj.start()
	}
}

module.exports = HTTP_Server