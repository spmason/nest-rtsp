const { EventEmitter } = require( 'events' )
const merge = require( 'lodash.merge' )
const debug = require( 'debug' )
const gc = require( '../google' )
const sleep = require( '../sleep' )
const streamer = require( '../streamer' )
const moment = require( 'moment' )
const clc = require( 'cli-color' )
const getSettings = require( '../../getSettings' )

class FeedClient extends EventEmitter {
	#id
	#db
	#status
	#debugger
	#expiration
	#serverPort
	#childprocess
	#method
	#path
	#stream
	#stopped = false
	#mqtt

	constructor( db, id, port, mqtt ) {
		super()
		this.#db = db
		this.#id = id
		const lastSlashPost = id.lastIndexOf( '/' )
		this.#debugger = debug( `nest-rtsp:controller:feed:${id.substr( lastSlashPost )}` )
		this.#status = 'Initializing'
		this.#serverPort = port
		this.#mqtt = mqtt
	}

	get status() {
		return this.#status
	}

	get expiring() {
		if ( this.#expiration ) {
			const expiresAtThresholdMoment = this.#expiration.clone().subtract( 1, 'minute' )
			const now = moment()
			return ( now.isSameOrAfter( expiresAtThresholdMoment ) )
		}
		return false
	}

	#getSettings = async function() {
		return await getSettings( this.#db )
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

	#getRTSPStream = async function() {
		const client = await this.#getGoogleClient()
		const { data } = await client.enterprises.devices.executeCommand( {
			name: this.#id,
			requestBody: {
				command: 'sdm.devices.commands.CameraLiveStream.GenerateRtspStream'
			}
		} )
		const { results } = data
		return results
	}

	#getWebRTCStream = async function() {
		const client = await this.#getGoogleClient()
		const { data } = await client.enterprises.devices.executeCommand( {
			name: this.#id,
			requestBody: {
				command: 'sdm.devices.commands.CameraLiveStream.GenerateWebRtcStream',
				params: {
					offerSdp: null // @TODO replace this
				}
			}
		} )
		const { results } = data
		return results
	}

	#setStatus = status => {
		this.#status = status
		this.emit( 'updated' )
		if ( this.#mqtt ) {
			this.#mqtt.publish( 'feed-status', {
				feed: this.#id,
				path: this.#path,
				status
			} )
		}
	}

	#startRTSP = async function( path ) {
		this.#debugger( `Fetching RTSP Stream for ${path}` )
		this.#setStatus( 'Fetching RTSP' )
		try {
			this.#stream = await this.#getRTSPStream.apply( this )
		}
		catch ( error ) {
			this.#debugger( `Failed to get stream for ${path} due to error: ${error.message}` )
			if ( error.message.includes( 'Rate limited' ) ) {
				this.#debugger( `Will retry to start ${path} in 60 seconds` )
				this.#setStatus( 'RTSP Rate Limited' )
				await sleep( 60000 )
			}
			else {
				this.#debugger( `Will retry to start ${path} in 5 seconds` )
				this.#setStatus( 'Retrying RTSP' )
				await sleep( 5000 )
			}
			return await this.#startRTSP( path )
		}
		if ( !this.#stream || !this.#stream.expiresAt || !this.#stream.streamUrls ) {
			this.#debugger( `Failed to get stream for ${path} without an error` )
			this.#debugger( `Will retry to start ${path} in 5 seconds` )
			this.#setStatus( 'Retrying RTSP' )
			await sleep( 5000 )
			return await this.#startRTSP( path )
		}
		const { streamUrls, expiresAt } = this.#stream
		this.#expiration = moment( expiresAt )
		const { rtspUrl } = streamUrls
		const { fp } = streamer.streamOut( rtspUrl, this.#serverPort, path )
		if ( fp.stdout ) {
			fp.stdout.on( 'data', data => {
				this.#debugger( `${clc.bgRedBright.black( '[STREAMER]' )}${clc.yellowBright( '[' + path + ']' )} ${clc.cyan( data )}` )
			} )
		}
		if ( fp.stderr ) {
			fp.stderr.on( 'data', data => {
				this.#debugger( `${clc.bgRedBright.black( '[STREAMER]' )}${clc.yellowBright( '[' + path + ']' )} ${clc.redBright( data )}` )
			} )
		}
		fp.on( 'exit', async code => {
			this.#debugger( `${clc.bgRedBright.black( '[STREAMER]' )}${clc.yellowBright( '[' + path + ']' )} exited with code ${clc.magentaBright( code )}` )
			if ( ![ 255 ].includes( parseInt( code ) ) && !this.#stopped ) {
				this.#debugger( `${clc.bgRedBright.black( '[STREAMER]' )}${clc.yellowBright( '[' + path + ']' )} ${clc.cyanBright( 'Attempting to automatically restart stream' )}` )
				await sleep( 5000 )
				return await this.#startRTSP( path )
			}
			this.#childprocess = null
			this.#setStatus( 'Stalled' )
		} )
		this.#childprocess = fp
		this.#setStatus( `PID ${this.#childprocess.pid}` )
	}

	#startWebRTC = async function ( path ) {
		this.#debugger( `Fetching WebRTC Stream for ${path}` )
		this.#setStatus( 'Fetching WebRTC' )
		try {
			this.#stream = await this.#getWebRTCStream.apply( this )
		}
		catch ( error ) {
			this.#debugger( `Failed to get stream for ${path} due to error: ${error.message}` )
			if ( error.message.includes( 'Rate limited' ) ) {
				this.#debugger( `Will retry to start ${path} in 60 seconds` )
				this.#setStatus( 'WebRTC Rate Limited' )
				await sleep( 60000 )
			}
			else {
				this.#debugger( `Will retry to start ${path} in 5 seconds` )
				this.#setStatus( 'Retrying WebRTC' )
				await sleep( 5000 )
			}
			return await this.#startWebRTC( path )
		}
		if ( !this.#stream || !this.#stream.expiresAt || !this.#stream.streamUrls ) {
			this.#debugger( `Failed to get stream for ${path} without an error` )
			this.#debugger( `Will retry to start ${path} in 5 seconds` )
			this.#setStatus( 'Retrying WebRTC' )
			await sleep( 5000 )
			return await this.#startRTSP( path )
		}
		console.log( this.#stream )
	}

	#extendRTSP = async function() {
		if ( this.#stream ) {
			const client = await this.#getGoogleClient()
			const { streamExtensionToken } = this.#stream
			const { data } = await client.enterprises.devices.executeCommand( {
				name: this.#id,
				requestBody: {
					command: 'sdm.devices.commands.CameraLiveStream.ExtendRtspStream',
					params: {
						streamExtensionToken
					}
				}
			} )
			const { results } = data
			const updated = merge( {}, this.#stream, results )
			this.#stream = updated
			const { expiresAt } = this.#stream
			this.#expiration = moment( expiresAt )
		}
	}

	#extendWebRTC = async function() {
		if ( this.#stream ) {
			const client = await this.#getGoogleClient()
			const { mediaSessionId } = this.#stream
			const { data } = await client.enterprises.devices.executeCommand( {
				name: this.#id,
				requestBody: {
					command: 'sdm.devices.commands.CameraLiveStream.ExtendWebRtcStream',
					params: {
						mediaSessionId
					}
				}
			} )
			const { results } = data
			const updated = merge( {}, this.#stream, results )
			this.#stream = updated
			const { expiresAt } = this.#stream
			this.#expiration = moment( expiresAt )
		}
	}

	async start() {
		this.#stopped = false
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
		this.#path = path
		this.#debugger = debug( `nest-rtsp:controller:feed:${path}` )
		this.#debugger( `Checking to see if ${path} supports RTSP` )
		const canRTSP = device.traits['sdm.devices.traits.CameraLiveStream'].supportedProtocols.includes( 'RTSP' )
		const canWebRTC = device.traits['sdm.devices.traits.CameraLiveStream'].supportedProtocols.includes( 'WEB_RTC' )
		if ( canRTSP ) {
			this.#debugger( `RTSP is supported for ${path}` )
			this.#method = 'rtsp'
			await this.#startRTSP.apply( this, [ path ] )
		}
		else if ( canWebRTC ) {
			this.#debugger( `WebRTC is supported for ${path}` )
			this.#method = 'webrtc'
			await this.#startWebRTC.apply( this, [ path ] )
		}
		else {
			this.#debugger( `RTSP and WebRTC are not supported for ${path}` )
			await this.stop()
			this.#setStatus( 'Unsupported - No Stream' )
		}
	}

	async stop() {
		this.#stopped = true
		this.#debugger( 'Stopping feed client' )
		this.#setStatus( 'Stopping' )
		if ( this.#childprocess ) {
			this.#childprocess.kill( 'SIGINT' )
		}
	}

	async restart() {
		this.#debugger( 'Restarting feed client' )
		await this.stop()
		this.#setStatus( 'Restarting' )
		await this.start()
	}

	async extend() {
		this.#debugger( 'Extending feed client' )
		try {
			switch ( this.#method ) {
				case 'rtsp': return await this.#extendRTSP.apply( this )
				case 'webrtc': return await this.#extendWebRTC.apply( this )
				default: return
			}
		}
		catch ( error ) {
			this.#debugger( 'Failed to extend feed. Restarting the hard way' )
			return await this.restart()
		}
	}

	static async tock( streams ) {
		const promises = [ ...streams ].map( async i => {
			const [ id, feed ] = i // eslint-disable-line no-unused-vars
			if ( feed.expiring && ( feed.status.startsWith( 'PID' ) ) ) {
				await feed.extend()
			}
		} )
		return await Promise.all( promises )
	}
}

module.exports = FeedClient