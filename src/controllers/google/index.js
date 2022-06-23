const { google } = require( 'googleapis' )
const { GA_SDM_PID } = process.env

const client = new google.auth.OAuth2( process.env.GA_OAUTH_CID, process.env.GA_OAUTH_CS, process.env.GA_OAUTH_RDR || 'http://localhost:3000' )
let oauth2

const getRedirectUrl = async ( state = null ) => {
	const u = client.generateAuthUrl( {
		access_type: 'offline',
		scope: [ 'openid', 'https://www.googleapis.com/auth/sdm.service' ],
		prompt: 'consent',
		include_granted_scopes: true,
		state
	} )
	return u
}

const getPCMRedirectUrl = async () => {
	return [ 'https://nestservices.google.com/partnerconnections', GA_SDM_PID ].join( '/' )
}

const handleResponse = async ( { code } ) => {
	try {
		const { tokens } = await client.getToken( code )
		setCredentials( tokens )
		oauth2 = google.oauth2( {
			auth: client,
			version: 'v2'
		} )
		return { tokens, oauth2, client, google }
	}
	catch ( error ) {
		return error
	}
}

const setCredentials = async tokens => {
	await client.setCredentials( tokens )
	oauth2 = google.oauth2( {
		auth: client,
		version: 'v2'
	} )
	return { client, oauth2, google }
}

const getRTSPStream = async name => {
	const service = google.smartdevicemanagement( {
		version: 'v1',
		auth: client
	} )
	const { data } = await service.enterprises.devices.executeCommand( {
		name,
		requestBody: {
			command: 'sdm.devices.commands.CameraLiveStream.GenerateRtspStream'
		}
	} )
	const { results } = data
	return results
}

const extendRTSPStream = async ( name, streamExtensionToken ) => {
	const service = google.smartdevicemanagement( {
		version: 'v1',
		auth: client
	} )
	const { data } = await service.enterprises.devices.executeCommand( {
		name,
		requestBody: {
			command: 'sdm.devices.commands.CameraLiveStream.ExtendRtspStream',
			params: {
				streamExtensionToken
			}
		}
	} )
	const { results } = data
	return results
}

const getDevices = async google_access_tokens => {
	const { client: oac, google } = await setCredentials( google_access_tokens )
	const client = google.smartdevicemanagement( {
		version: 'v1',
		auth: oac
	} )
	const { data: list } = await client.enterprises.devices.list( { parent: [ 'enterprises', GA_SDM_PID ].join( '/' ) } )
	const { devices } = list
	const cameras = devices ? devices.filter( d => Object.keys( d.traits ).includes( 'sdm.devices.traits.CameraLiveStream' ) ) : []
	return cameras
}

module.exports = {
	getRedirectUrl,
	getPCMRedirectUrl,
	handleResponse,
	setCredentials,
	oauth2,
	getRTSPStream,
	extendRTSPStream,
	getDevices
}