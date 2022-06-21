const { providers, controllers } = require( './src' )
const { http, rtsp, configuration } = providers
const knex = require( 'knex' )
const db = knex( configuration.get( 'database' ) )
const clc = require( 'cli-color' )
const debug = require( 'debug' )

http.init( configuration.get( 'http.port' ) ).then( async ( { port, server } ) => {
	const streams = new Map()
	const dbg = debug( 'nest-rtsp:app' )
	const mqtt = new controllers.mqtt()
	const rtsps = await rtsp.init( configuration.get( 'rtsp' ) )
	dbg( `RTSP Server listening for clients on 0.0.0.0:${rtsps.ports.client} and listening for streams on 0.0.0.0:${rtsps.ports.server}` )
	const app = new controllers.app( server, port, db )
	// setup the event listeners for specific requests
	mqtt.on( 'updated', app.tick.bind( app, streams, mqtt ) )
	app.on( 'gaurl', async ( id, args, settings, respond, error ) => {
		try {
			const url = await controllers.google.getRedirectUrl( id )
			dbg( `Got Google OAuth URL "${url}"` )
			respond( id, url )
		}
		catch ( err ) {
			error( id, err )
		}
	} )
	app.on( 'pcmurl', async ( id, args, settings, respond, error ) => {
		try {
			const url = await controllers.google.getPCMRedirectUrl( id )
			dbg( `Got Google Device Manager URL "${url}"` )
			respond( id, url )
		}
		catch ( err ) {
			error( id, err )
		}
	} )
	app.on( 'listDevices', async ( id, args, settings, respond, error ) => {
		const { google_access_tokens } = settings
		try {
			const list = await controllers.google.getDevices( google_access_tokens )
			respond( id, list )
		}
		catch ( err ) {
			await db.table( 'settings' ).where( 'key', 'google_access_tokens' ).del()
			error( id, err )
		}
	} )
	app.on( 'handleOauthResponse', async ( id, args, settings, respond, error ) => {
		let tokens
		try {
			const ret = await controllers.google.handleResponse( args )
			tokens = ret.tokens
		}
		catch ( err ) {
			error( id, err )
		}
		if ( !tokens ) {
			return error( id, new Error( 'Authentication Failed' ) )
		}
		const { count } = await db.table( 'settings' ).count( 'key', { as: 'count' } ).where( 'key', 'google_access_tokens' ).first()
		if ( 0 < parseInt( count ) ) {
			await db.table( 'settings' ).update( { value: JSON.stringify( tokens ) } ).where( 'key', 'google_access_tokens' )
		}
		else {
			await db.table( 'settings' ).insert( { key: 'google_access_tokens', value: JSON.stringify( tokens ) } )
		}
		respond( id, tokens )
	} )
	app.on( 'saveRTSP', async ( id, args, settings, respond ) => {
		const { count } = db.table( 'settings' ).count( 'key', { as: 'count' } ).where( 'key', 'rtsp_map' ).first()
		if ( 0 < parseInt( count ) ) {
			await db.table( 'settings' ).update( { value: JSON.stringify( args ) } ).where( 'key', 'rtsp_map' )
		}
		else {
			await db.table( 'settings' ).insert( { key: 'rtsp_map', value: JSON.stringify( args ) } )
		}
		respond( id, 'OK' )
	} )
	app.on( 'saveRTSPPath', async ( id, args, settings, respond ) => {
		const { count } = db.table( 'settings' ).count( 'key', { as: 'count' } ).where( 'key', 'rtsp_paths' ).first()
		if ( 0 < parseInt( count ) ) {
			await db.table( 'settings' ).update( { value: JSON.stringify( args ) } ).where( 'key', 'rtsp_paths' )
		}
		else {
			await db.table( 'settings' ).insert( { key: 'rtsp_paths', value: JSON.stringify( args ) } )
		}
		respond( id, 'OK' )
	} )
	app.on( 'startRTSP', async ( rid, args, settings, respond, error ) => {
		const id = args
		if ( streams.has( id ) ) {
			return error( rid, new Error( 'Stream Already Exists' ) )
		}
		streams.set( id, new controllers.feed( db, id, rtsps.ports.server, mqtt ) )
		streams.get( id ).on( 'updated', app.tick.bind( app, streams, mqtt ) )
		await streams.get( id ).start()
		await app.snapshot( streams )
		return respond( rid, 'OK' )
	} )
	app.on( 'restartRTSP', async ( rid, args, settings, respond, error ) => {
		const id = args
		if ( !streams.has( id ) ) {
			return error( rid, new Error( 'No such stream' ) )
		}
		await streams.get( id ).restart()
		return respond( rid, 'OK' )
	} )
	app.on( 'stopRTSP', async ( rid, args, settings, respond, error ) => {
		const id = args
		if ( !streams.has( id ) ) {
			return error( rid, new Error( 'No such stream' ) )
		}
		await streams.get( id ).stop()
		streams.delete( id )
		await app.tick( streams, mqtt )
		await app.snapshot( streams )
		return respond( rid, 'OK' )
	} )
	app.on( 'saveMQTT', async ( rid, args, settings, respond, error ) => {
		const { count } = db.table( 'settings' ).count( 'key', { as: 'count' } ).where( 'key', 'mqtt_settings' ).first()
		if ( 0 < parseInt( count ) ) {
			await db.table( 'settings' ).update( { value: JSON.stringify( args ) } ).where( 'key', 'mqtt_settings' )
		}
		else {
			await db.table( 'settings' ).insert( { key: 'mqtt_settings', value: JSON.stringify( args ) } )
		}
		respond( rid, 'OK' )
	} )
	app.on( 'startMQTT', async ( rid, args, settings, respond, error ) => {
		const res = await mqtt.start( settings.mqtt_settings )
		if ( res ) {
			respond( rid, 'OK' )
		}
		else {
			error( rid, 'Failed to start' )
		}
	} )
	app.on( 'restartMQTT', async ( rid, args, settings, respond, error ) => {
		const res = await mqtt.restart()
		if ( res ) {
			respond( rid, 'OK' )
		}
		else {
			error( rid, 'Failed to restart' )
		}
	} )
	app.on( 'stopMQTT', async ( rid, args, settings, respond, error ) => {
		const res = await mqtt.stop()
		if ( res ) {
			respond( rid, 'OK' )
		}
		else {
			error( rid, 'Failed to stop' )
		}
	} )
	mqtt.on( 'start', async ( payload, all ) => {
		const { google_access_tokens, rtsp_paths } = await app.getSettings()
		if ( 'string' === typeof all && 'all' === all ) {
			dbg( 'Got Start All command from MQTT' )
			const list = await controllers.google.getDevices( google_access_tokens )
			const ids = list.map( c => c.name )
			for ( let i = 0; i < ids.length; i++ ) {
				const id = ids[i]
				if ( !streams.has( id ) ) {
					streams.set( id, new controllers.feed( db, id, rtsps.ports.server, mqtt ) )
					streams.get( id ).on( 'updated', app.tick.bind( app, streams, mqtt ) )
					await streams.get( id ).start()
				}
			}
			dbg( 'Started All available cameras' )
		}
		else if ( payload.path ){
			dbg( `Got Start Command for path "${payload.path}"` )
			for ( const id in rtsp_paths ) {
				if ( rtsp_paths[id] === payload.path ) {
					if ( !streams.has( id ) ) {
						streams.set( id, new controllers.feed( db, id, rtsps.ports.server, mqtt ) )
						streams.get( id ).on( 'updated', app.tick.bind( app, streams, mqtt ) )
						await streams.get( id ).start()
					}
				}
			}
		}
		else if ( payload.id ){
			dbg( `Got Start Command for id "${payload.id}"` )
			if ( !streams.has( payload.id ) ) {
				streams.set( payload.id, new controllers.feed( db, payload.id, rtsps.ports.server, mqtt ) )
				streams.get( payload.id ).on( 'updated', app.tick.bind( app, streams, mqtt ) )
				await streams.get( payload.id ).start()
			}
		}
		await app.tick( streams, mqtt )
		await app.snapshot( streams )
	} )
	mqtt.on( 'stop', async ( payload, all ) => {
		const { rtsp_paths } = await app.getSettings()
		if ( 'string' === typeof all && 'all' === all ) {
			dbg( 'Got Stop All command from MQTT' )
			const toStop = [ ...streams ]
			for ( let i = 0; i < toStop.length; i++ ) {
				const [ id, stream ] = toStop[i]
				await stream.stop()
				streams.delete( id )
				await app.tick( streams, mqtt )
			}
		}
		else if ( payload.path ){
			dbg( `Got Stop Command for path "${payload.path}"` )
			for ( const id in rtsp_paths ) {
				if ( rtsp_paths[id] === payload.path ) {
					if ( streams.has( id ) ) {
						await streams.get( id ).stop()
						streams.delete( id )
					}
				}
			}
		}
		else if ( payload.id ){
			dbg( `Got Stop Command for id "${payload.id}"` )
			if ( streams.has( payload.id ) ) {
				await streams.get( payload.id ).stop()
				streams.delete( payload.id )
			}
		}
		await app.tick( streams, mqtt )
		await app.snapshot( streams )
	} )
	mqtt.on( 'failed', error => {
		app.broadcast( 'notification', {
			group: 'errors',
			text: `MQTT Stopped due to error: ${error.message}`,
			ignoreDuplicates: true
		} )
	} )
	const { google_access_tokens, rtsps_snapshot, mqtt_settings } = await app.getSettings()
	if ( mqtt_settings.enabled ) {
		await mqtt.start( mqtt_settings )
	}
	if ( null !== google_access_tokens ) {
		// Checking to see if the existing OAuth session is valid
		dbg( 'Checking to see if the existing OAuth session is valid' )
		try {
			await controllers.google.getDevices( google_access_tokens )
		}
		catch ( err ) {
			dbg( `Authentication failed due to error: ${err.message}. Should clear credentials.` )
			await db.table( 'settings' ).where( 'key', 'google_access_tokens' ).del()
		}
	}
	dbg( 'Loading Streams from Persistance Snapshot' )
	rtsps_snapshot.map( async id => {
		if ( !streams.has( id ) ) {
			dbg( `Loading Stream for ${id}` )
			streams.set( id, new controllers.feed( db, id, rtsps.ports.server ) )
			streams.get( id ).on( 'updated', app.tick.bind( app, streams, mqtt ) )
			await streams.get( id ).start()
			dbg( `Loaded Stream for ${id}` )
		}
	} )
	dbg( 'Loaded Streams from Persistance Snapshot' )
	dbg( 'Starting Status Broadcast' )
	setInterval( app.tick.bind( app, streams, mqtt ), 1000 )
	setInterval( controllers.feed.tock, 30000, streams )
	dbg( 'Sending First Status Update' )
	app.tick( streams, mqtt )
	controllers.feed.tock( streams )
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