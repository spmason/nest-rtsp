const { EventEmitter } = require( 'events' )
const debug = require( 'debug' )
const mqtt = require( 'mqtt' )
const merge = require( 'lodash.merge' )
const shortid = require( 'shortid' )
const { inspect } = require( 'util' )

class MQTT extends EventEmitter {
	#clientId = null
	#running = false
	#settings = {
		enabled: false,
		host: '',
		user: '',
		password: ''
	}
	#client
	#debugger = debug( 'nest-rtsp:controller:mqtt' )

	constructor() {
		super()
		this.#clientId = [ 'nest-rtsp', shortid.generate() ].join( '_' )
	}

	get running() {
		return this.#running
	}

	#onConnection = function() {
		this.#debugger( 'Connected to MQTT Server. Subscribing to nest-rtsp topic' )
		this.#client.subscribe( 'nest-rtsp/#', err => {
			if ( !err ) {
				this.publish( 'online', true )
			}
		} )
	}

	#onMessage = function( topic, message ) {
		try {
			const tps = topic.split( '/' ).filter( t => 'nest-rtsp' !== t )
			const event = tps.shift()
			const payload = JSON.parse( message.toString() )
			if ( ( payload.from && payload.from !== this.#clientId ) || !payload.from ) {
				this.#debugger( `Got event ${event} with payload ${inspect( payload, false, 5, true )}` )
				const args = [ ...tps ]
				if ( Array.isArray( payload.args ) ) {
					payload.args.map( a => args.push( a ) )
					delete payload.args
				}
				this.#debugger( `Parsed Args: ${inspect( args, false, 5, true )}` )
				if ( 'error' !== event ) {
					this.emit( event, payload, ...args )
				}
			}
		}
		catch ( e ) {
			this.#debugger( `Could not parse message due to error: ${e.message}. Message: ${message.toString()}` )
		}
	}

	#onError = function( error ) {
		this.#debugger( `A connection error occured: ${error.message}` )
		this.emit( 'failed', error )
		this.stop()
	}

	publish( ...args ) {
		if ( this.running ) {
			const event = args.shift()
			const payload = {
				from: this.#clientId,
				event,
				args
			}
			this.#client.publish( [ 'nest-rtsp', event ].join( '/' ), JSON.stringify( payload ) )
		}
	}

	async start( settings, fromRestart = false ) {
		if ( this.#running && !fromRestart ) {
			this.#debugger( 'Already running. Cannot start again' )
			return false
		}
		this.#settings = merge( {}, this.#settings, settings )
		if ( !this.#settings.enabled ) {
			this.#debugger( 'MQTT not enabled. Stopping' )
			return false
		}
		const uri = `mqtt://${this.#settings.host}`
		const opts = {
			keepalive: 60,
			reschedulePings: true,
			clientId: this.#clientId,
			protocolId: 'MQTT',
			protocolVersion: 4,
			clean: true,
			reconnectPeriod: 1000,
			connectTimeout: 30000,
			username: this.#settings.user ? this.#settings.user : null,
			password: this.#settings.password ? this.#settings.password : null,
			queueQoSZero: true,
			autoUseTopicAlias: true,
			autoAssignTopicAlias: true,
			resubscribe: true
		}
		this.#client = mqtt.connect( uri, opts )
		this.#client.on( 'connect', this.#onConnection.bind( this ) )
		this.#client.on( 'message', this.#onMessage.bind( this ) )
		this.#client.on( 'error', this.#onError.bind( this ) )
		this.#running = true
		this.emit( 'updated' )
		return true
	}

	async restart() {
		if ( !this.#running ) {
			this.#debugger( 'Not running. Cannot restart' )
			return false
		}
		this.#client.end( true )
		this.#client = null
		await this.start( this.#settings, true )
		return true
	}

	async stop() {
		if ( !this.#running ) {
			this.#debugger( 'Not running. Cannot stop' )
			return false
		}
		this.#client.end( true )
		this.#client = null
		this.#settings = {
			enabled: false,
			host: '',
			user: '',
			password: ''
		}
		this.#running = false
		this.emit( 'updated' )
		return true
	}
}

module.exports = MQTT