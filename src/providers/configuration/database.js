const merge = require( 'lodash.merge' )
const path = require( 'path' )
const mustache = require( 'mustache' )
let cfg = {
	client: 'better-sqlite3',
	connection: {
		filename: path.join( __dirname, '..', '..', '..', 'persistent', 'nest-rtsp.sqlite' )
	},
	useNullAsDefault: true
}
if ( 'string' === typeof process.env.DB_CONFIG ) {
	try {
		cfg = JSON.parse( mustache.render( process.env.DB_CONFIG, process.env ) )
	}
	catch {
		// do nothing
	}
}

module.exports = merge( {}, cfg, {
	migrations: {
		directory: path.join( __dirname, '..', '..', '..', 'database', 'migrations' ),
		tableName: 'nest_rtsp_schema'
	}
} )