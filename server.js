const { providers, controllers } = require( './src' )
const { http, rtsp, configuration } = providers
const knex = require( 'knex' )
const db = knex( configuration.get( 'database' ) )
const merge = require( 'lodash.merge' )
const { GA_SDM_PID } = process.env
const clc = require( 'cli-color' )
const moment = require( 'moment' )
http.init( configuration.get( 'http.port' ) ).then( async ( { port, server } ) => {
	console.log( `HTTP Server listening on 0.0.0.0:${port}` )
	const rtsps = await rtsp.init( configuration.get( 'rtsp' ) )
	console.log( `RTSP Server listening for clients on 0.0.0.0:${rtsps.ports.client} and listening for streams on 0.0.0.0:${rtsps.ports.server}` )
	const processes = new Map()
	const streams = new Map()
	const settings = async () => {
		const rows = await db.table( 'settings' )
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
	const devices = async google_access_tokens => {
		const { client:gc, google } = await controllers.google.setCredentials( google_access_tokens )
		// here we are going to check our authentication credentials
		const client = google.smartdevicemanagement( {
			version: 'v1',
			auth: gc
		} )
		try {
			const { data: list } = await client.enterprises.devices.list( { parent: [ 'enterprises', GA_SDM_PID ].join( '/' ) } )
			const { devices } = list
			const cameras = devices.filter( d => Object.keys( d.traits ).includes( 'sdm.devices.traits.CameraLiveStream' ) )
			return cameras
		}
		catch ( error ) {
			console.log( `Failed to load device list due to error: ${error.message}` )
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
			return []
		}
	}
	const tick = async () => {
		const current = await settings()
		server.broadcast( 'status', current )
		const alive = Object.assign( {}, ...[ ...processes ].map( ( [ id, cp ] )=> {
			return { [id]: cp.pid }
		} ) )
		server.broadcast( 'processes', alive )
	}
	const tock = async () => {
		const { rtsp_paths } = await settings()
		const sa = [ ...streams ]
		for ( let i = 0; i < sa.length; i++ ) {
			const [ id, info ] = sa[i]
			const path = rtsp_paths[id]
			if ( !processes.has( id ) ) {
				// the stream process is missing. remove it and try to restart it
				console.log( `${clc.bgRedBright.black( '[STREAMER]' )}${clc.yellowBright( '[' + path + ']' )} Process is missing. Clearing and restarting.` )
				streams.delete( id )
				process.nextTick( () => {
					startRTSP( id, true )
				} )
			}
			else {
				// the stream process exists. check if it is running and then continue
				const cp = processes.get( id )
				if ( null !== cp.exitCode ) {
					// the stream is not running. clear the process and info, and restart the stream
					console.log( `${clc.bgRedBright.black( '[STREAMER]' )}${clc.yellowBright( '[' + path + ']' )} Process is ${clc.redBright( 'DEAD' )}. Clearing and restarting.` )
					streams.delete( id )
					processes.delete( id )
					process.nextTick( () => {
						startRTSP( id, true )
					} )
				}
				else {
					const { expiresAt, streamExtensionToken } = info
					const expiresAtMoment = moment( expiresAt )
					const expiresAtThresholdMoment = expiresAtMoment.clone().subtract( 1, 'minute' )
					const now = moment()
					if ( now.isSameOrAfter( expiresAtThresholdMoment ) ) {
						console.log( `${clc.bgBlue.white( '[GOOGLE]' )}${clc.yellowBright( '[' + path + ']' )} Extending Stream` )
						const results = await controllers.google.extendRTSPStream( id, streamExtensionToken )
						const updated = merge( {}, info, results )
						streams.set( id, updated )
					}
				}
			}
		}
	}
	const startRTSP = async ( id, booting, retry = 0 ) => {
		const { rtsp_paths } = await settings()
		const port = parseInt( rtsps.ports.server )
		const path = rtsp_paths[id]
		if ( !processes.has( id ) ) {
			console.log( `${clc.bgRedBright.black( '[STREAMER]' )}${clc.yellowBright( '[' + path + ']' )} ${clc.greenBright( `Starting stream for ${ clc.whiteBright( id ) } on path ${clc.cyanBright( path )}` )}` )
			const stream = await controllers.google.getRTSPStream( id )
			const streamUrl = stream.streamUrls.rtspUrl
			streams.set( id, stream )
			rtsps.add( path )
			const { fp } = controllers.streamer.streamOut( streamUrl, port, path )
			processes.set( id, fp )
			if ( fp.stdout ) {
				fp.stdout.on( 'data', data => {
					console.log( `${clc.bgRedBright.black( '[STREAMER]' )}${clc.yellowBright( '[' + path + ']' )} ${clc.cyan( data )}` )
				} )
			}
			if ( fp.stderr ) {
				fp.stderr.on( 'data', data => {
					console.log( `${clc.bgRedBright.black( '[STREAMER]' )}${clc.yellowBright( '[' + path + ']' )} ${clc.redBright( data )}` )
					if ( 'string' === typeof data && data.includes( 'The specified session has been invalidated for some reason.' ) ) {
						console.log( `${clc.bgRedBright.black( '[STREAMER]' )}${clc.yellowBright( '[' + path + ']' )} ${clc.cyanBright( 'Attempting to automatically restart stream' )}` )
						fp.once( 'exit', code => {
							if ( 0 === parseInt( code ) ) {
								processes.delete( id )
								streams.delete( id )
								process.nextTick( () => {
									startRTSP( id, true )
								} )
							}
						} )
					}
				} )
			}
			fp.on( 'exit', code => {
				console.log( `${clc.bgRedBright.black( '[STREAMER]' )}${clc.yellowBright( '[' + path + ']' )} exited with code ${clc.magentaBright( code )}` )
				processes.delete( id )
				streams.delete( id )
				if ( ![ 255,0 ].includes( parseInt( code ) ) && 5 > retry ) {
					console.log( `${clc.bgRedBright.black( '[STREAMER]' )}${clc.yellowBright( '[' + path + ']' )} ${clc.cyanBright( 'Attempting to automatically restart stream' )}` )
					process.nextTick( () => {
						startRTSP( id, true, retry + 1 )
					} )
				}
			} )
		}
		if ( !booting ) {
			saveRTSPStatus()
		}
	}
	const stopRTSP = async ( id, booting ) => {
		if ( processes.has( id ) ) {
			console.log( `stopping stream for ${id}` )
			processes.get( id ).on( 'exit', () => {
				if ( !booting ) {
					saveRTSPStatus()
				}
			} )
			processes.get( id ).kill( 'SIGINT' )
			const { rtsp_paths } = await settings()
			const path = rtsp_paths[id]
			rtsps.remove( path )
			processes.delete( id )
			streams.delete( id )
		}
		if ( !booting ) {
			saveRTSPStatus()
		}
	}
	const saveRTSPStatus = async () => {
		const alive = [ ...processes ].map( ( [ id, cp ] )=> { // eslint-disable-line no-unused-vars
			return id
		} )
		const { count } = await db.table( 'settings' ).count( 'key', { as: 'count' } ).where( 'key', 'rtsps_snapshot' ).first()
		if ( 0 < parseInt( count ) ) {
			await db.table( 'settings' ).update( { value: JSON.stringify( alive ) } ).where( 'key', 'rtsps_snapshot' )
		}
		else {
			await db.table( 'settings' ).insert( { key: 'rtsps_snapshot', value: JSON.stringify( alive ) } )
		}
	}
	const { google_access_tokens, rtsps_snapshot } = await settings()
	if ( null !== google_access_tokens ) {
		try {
			await devices( google_access_tokens )
		}
		catch ( err ) {
			console.log( `Authentication failed due to error: ${err.message}. Should clear credentials.` )
			await db.table( 'settings' ).where( 'key', 'google_access_tokens' ).del()
		}
	}
	else {
		console.log( 'Google Access Credentials not Detected' )
	}
	rtsps_snapshot.map( id => startRTSP( id, true ) )
	server.on( 'request', ( { id, cmd, args } ) => {
		settings().then( ( { google_access_tokens } ) => {
			switch ( cmd ) {
				case 'ping': server.emit( `response-${id}`, 'pong' ); break
				case 'refresh': tick( args ).then( () => {
					server.emit( `response-${id}`, 'OK' )
				} ); break
				case 'gaurl': controllers.google.getRedirectUrl( id ).then( url => {
					server.emit( `response-${id}`, url )
				} ); break
				case 'pcmurl': controllers.google.getPCMRedirectUrl( id ).then( url => {
					server.emit( `response-${id}`, url )
				} ); break
				case 'listDevices': devices( google_access_tokens ).then( list => {
					server.emit( `response-${id}`, list )
				} ).catch( err => {
					server.emit( `error-${id}`, err.message )
				} ); break
				case 'handleOauthResponse': controllers.google.handleResponse( args ).then( async ( { tokens } ) => {
					if ( tokens ) {
						const { count } = await db.table( 'settings' ).count( 'key', { as: 'count' } ).where( 'key', 'google_access_tokens' ).first()
						if ( 0 < parseInt( count ) ) {
							await db.table( 'settings' ).update( { value: JSON.stringify( tokens ) } ).where( 'key', 'google_access_tokens' )
						}
						else {
							await db.table( 'settings' ).insert( { key: 'google_access_tokens', value: JSON.stringify( tokens ) } )
						}
						server.emit( `response-${id}`, tokens )
					}
					else {
						server.emit( `error-${id}`, new Error( 'Authentication Failed' ) )
					}
				} ); break
				case 'logout': db.table( 'settings' ).where( 'key', 'google_access_tokens' ).del().then( () => {
					server.emit( `response-${id}`, 'OK' )
				} ); break
				case 'saveRTSP': db.table( 'settings' ).count( 'key', { as: 'count' } ).where( 'key', 'rtsp_map' ).first().then( async ( { count } ) => {
					if ( 0 < parseInt( count ) ) {
						await db.table( 'settings' ).update( { value: JSON.stringify( args ) } ).where( 'key', 'rtsp_map' )
					}
					else {
						await db.table( 'settings' ).insert( { key: 'rtsp_map', value: JSON.stringify( args ) } )
					}
					server.emit( `response-${id}`, 'OK' )
				} ); break
				case 'saveRTSPPath': db.table( 'settings' ).count( 'key', { as: 'count' } ).where( 'key', 'rtsp_paths' ).first().then( async ( { count } ) => {
					if ( 0 < parseInt( count ) ) {
						await db.table( 'settings' ).update( { value: JSON.stringify( args ) } ).where( 'key', 'rtsp_paths' )
					}
					else {
						await db.table( 'settings' ).insert( { key: 'rtsp_paths', value: JSON.stringify( args ) } )
					}
					server.emit( `response-${id}`, 'OK' )
				} ); break
				case 'startRTSP': startRTSP( args ).then( () => {
					server.emit( `response-${id}`, 'OK' )
				} ); break
				case 'restartRTSP': stopRTSP( args ).then( () => {
					startRTSP( args ).then( () => {
						server.emit( `response-${id}`, 'OK' )
					} )
				} ); break
				case 'stopRTSP': stopRTSP( args ).then( () => {
					server.emit( `response-${id}`, 'OK' )
				} ); break
				default: server.emit( `error-${id}`, new Error( `No such command "${cmd}"` ) )
			}
		} )
	} )
	// once per second, check the status and forward it to the GUI
	setInterval( tick, 1000 )
	setInterval( tock, 30000 )
	tick()
	tock()
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