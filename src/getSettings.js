const merge = require( 'lodash.merge' )
module.exports = async function( db ) {
	const rows = await db.table( 'settings' )
	const fromDb = Object.assign( {}, ...rows.map( r => {
		return { [r.key]: JSON.parse( r.value ) }
	} ) )
	const settings = merge( {}, {
		google_access_tokens: null,
		rtsp_map: {},
		rtsp_paths: {},
		rtsps_snapshot: [],
		mqtt_settings: {
			enabled: false,
			host: '',
			user: '',
			password: ''
		}
	}, fromDb )
	return settings
}