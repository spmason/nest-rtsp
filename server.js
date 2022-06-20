const { providers, controllers } = require( './src' )
const { http, rtsp, configuration } = providers
const knex = require( 'knex' )
const db = knex( configuration.get( 'database' ) )
const clc = require( 'cli-color' )
// const moment = require( 'moment' )
const debug = require( 'debug' )

http.init( configuration.get( 'http.port' ) ).then( async ( { port, server } ) => {
	const streams = new Map()
	const dbg = debug( 'nest-rtsp:app' )
	const rtsps = await rtsp.init( configuration.get( 'rtsp' ) )
	dbg( `RTSP Server listening for clients on 0.0.0.0:${rtsps.ports.client} and listening for streams on 0.0.0.0:${rtsps.ports.server}` )
	const app = new controllers.app( server, port, db )
	// setup the event listeners for specific requests
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
		streams.set( id, new controllers.feed( db, id, rtsps.ports.server ) )
		streams.get( id ).on( 'updated', app.tick.bind( app, streams ) )
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
		await app.tick( streams )
		await app.snapshot( streams )
		return respond( rid, 'OK' )
	} )
	const { google_access_tokens, rtsps_snapshot } = await app.getSettings()
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
			streams.get( id ).on( 'updated', app.tick.bind( app, streams ) )
			await streams.get( id ).start()
			dbg( `Loaded Stream for ${id}` )
		}
	} )
	dbg( 'Loaded Streams from Persistance Snapshot' )
	dbg( 'Starting Status Broadcast' )
	setInterval( app.tick.bind( app, streams ), 1000 )
	dbg( 'Sending First Status Update' )
	app.tick( streams )
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