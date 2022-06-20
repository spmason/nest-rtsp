const { EventEmitter } = require( 'events' )
const merge = require( 'lodash.merge' )
const debug = require( 'debug' )

class AppController extends EventEmitter {
	#server
	#db
	#debugger

	constructor( server, port, db ) {
		super()
		this.#server = server
		this.#db = db
		this.#debugger = debug( 'nest-rtsp:controller:app' )
		this.on( 'logout', this.#onRequestLogout.bind( this ) )
		this.on( 'ping', this.#onRequestPing.bind( this ) )
		this.on( 'refresh', this.#onRequestRefresh.bind( this ) )
		this.#server.on( 'request', this.#onRequest.bind( this ) )
		this.#debugger( `HTTP Server listening on 0.0.0.0:${port}` )
	}

	#onRequestPing = function( id ) {
		this.#respond( id, 'pong' )
	}

	#onRequestRefresh = async function( id ) {
		await this.tick()
		this.respond( id )
	}

	#onRequestLogout = async function( id ) {
		await this.#db.table( 'settings' ).where( 'key', 'google_access_tokens' ).del()
		this.#respond( id, 'OK' )
	}

	#onRequest = async function( { id, cmd, args } ) {
		this.#debugger( `Got "${cmd}" request with id "${id}"` )
		if ( Object.keys( this._events ).includes( cmd ) ) {
			this.#debugger( `Sent event for command "${cmd}" for request id "${id}"` )
			const settings = await this.getSettings()
			this.emit( cmd, id, args, settings, this.#respond.bind( this, id ), this.#error.bind( this, id ) )
		}
		else {
			this.#debugger( `No such command "${cmd}" for request id "${id}"` )
			this.#error( id, new Error( `No such command ${cmd}` ) )
		}
	}

	async getSettings() {
		const rows = await this.#db.table( 'settings' )
		const fromDb = Object.assign( {}, ...rows.map( r => {
			return { [r.key]: JSON.parse( r.value ) }
		} ) )
		const settings = merge( {}, {
			google_access_tokens: null,
			rtsp_map: {},
			rtsp_paths: {},
			rtsps_snapshot: []
		}, fromDb )
		return settings
	}

	#respond = function( rid, ...args ) {
		this.#debugger( `Sending response for request id "${rid}"` )
		args.shift()
		this.#server.emit( `response-${rid}`, ...args )
	}

	#error = function( rid, ...args ) {
		this.#debugger( `Sending error for request id "${rid}"` )
		args.shift()
		this.#server.emit( `error-${rid}`, ...args )
	}

	broadcast( ...args ) {
		this.#server.broadcast( ...args )
	}

	async tick( streams ) {
		const current = await this.getSettings()
		this.broadcast( 'status', current )
		if ( streams ) {
			const alive = Object.assign( {}, ...[ ...streams ].map( ( [ id, cp ] )=> {
				return { [id]: cp.status }
			} ) )
			this.broadcast( 'processes', alive )
		}
	}

	async snapshot( streams ) {
		this.#debugger( 'Saving Status Snapshot' )
		const alive = [ ...streams ].map( ( [ id, cp ] )=> { // eslint-disable-line no-unused-vars
			return id
		} )
		const { count } = await this.#db.table( 'settings' ).count( 'key', { as: 'count' } ).where( 'key', 'rtsps_snapshot' ).first()
		if ( 0 < parseInt( count ) ) {
			await this.#db.table( 'settings' ).update( { value: JSON.stringify( alive ) } ).where( 'key', 'rtsps_snapshot' )
		}
		else {
			await this.#db.table( 'settings' ).insert( { key: 'rtsps_snapshot', value: JSON.stringify( alive ) } )
		}
		this.#debugger( 'Saved Status Snapshot' )
	}
}

module.exports = AppController