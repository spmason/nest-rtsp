const { EventEmitter } = require( 'events' )
const merge = require( 'lodash.merge' )
const debug = require( 'debug' )
const gc = require( '../google' )

class FeedClient extends EventEmitter {
	#id
	#db
	#status
	#debugger
	#expiration
	#serverPort
	#childprocess

	constructor( db, id, port ) {
		super()
		this.#db = db
		this.#id = id
		this.#debugger = debug( `nest-rtsp:controller:feed:${id}` )
		this.#status = 'Initializing'
		this.#serverPort = port
	}

	get status() {
		return this.#status
	}

	#getSettings = async function() {
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

	#getGoogleClient = async function() {
		const { google_access_tokens } = await this.#getSettings()
		const { client: oac, google } = await gc.setCredentials( google_access_tokens )
		const client = google.smartdevicemanagement( { version: 'v1', auth: oac } )
		return client
	}

	#getGoogleDevice = async function() {
		const client = await this.#getGoogleClient()
		const { data } = await client.enterprises.devices.get( { name: this.#id } )
		return data
	}

	#setStatus = status => {
		this.#status = status
		this.emit( 'updated' )
	}

	#startRTSP = function( path ) {
		this.#debugger( `Fetching RTSP Stream for ${path}` )
		this.#setStatus( 'Fetching RTSP' )
	}

	#startWebRTC = function ( path ) {
		this.#debugger( `Fetching WebRTC Stream for ${path}` )
		this.#setStatus( 'Fetching WebRTC' )
	}

	async start() {
		this.#debugger( `Starting feed client for ${this.#id}` )
		let device
		try {
			device = await this.#getGoogleDevice.apply( this )
		}
		catch ( error ) {
			this.#debugger( `Failed to get device information due to error: ${error.message}` )
		}
		if ( !device || !device.traits || !device.traits['sdm.devices.traits.CameraLiveStream'] || !device.traits['sdm.devices.traits.CameraLiveStream'].supportedProtocols ) {
			this.#setStatus( 'Failed' )
			return
		}
		const { rtsp_paths } = await this.#getSettings()
		const path = rtsp_paths[this.#id]
		this.#debugger( `Checking to see if ${path} supports RTSP` )
		const canRTSP = device.traits['sdm.devices.traits.CameraLiveStream'].supportedProtocols.includes( 'RTSP' )
		const canWebRTC = device.traits['sdm.devices.traits.CameraLiveStream'].supportedProtocols.includes( 'WEB_RTC' )
		if ( canRTSP ) {
			this.#debugger( `RTSP is supported for ${path}` )
			await this.#startRTSP.apply( this, [ path ] )
		}
		else if ( canWebRTC ) {
			this.#debugger( `WebRTC is supported for ${path}` )
			await this.#startWebRTC.apply( this, [ path ] )
		}
		else {
			this.#debugger( `RTSP and WebRTC are not supported for ${path}` )
			await this.stop()
			this.#setStatus( 'Unsupported - No Stream' )
		}
	}

	async stop() {
		this.#debugger( `Stopping feed client for ${this.#id}` )
		this.#setStatus( 'Stopping' )
	}

	async restart() {
		this.#debugger( `Restarting feed client for ${this.#id}` )
		await this.stop()
		this.#setStatus( 'Restarting' )
		await this.start()
	}
}

module.exports = FeedClient