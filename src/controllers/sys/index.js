const pckg = require( '../../../package.json' )
const os = require( 'os' )
const { default: prettyBytes } = require( 'human-readable-bytes' )
const { exec } = require( 'child_process' )

const getCPUInfo = () => {
	const ret = {}
	const d = [ ...os.cpus() ].map( c => { // eslint-disable-line
		const k = [ c.model, c.speed ].join( ' - ' )
		if ( 'undefined' === typeof ret[k] ) {
			ret[k] = 1
		}
		else {
			ret[k] ++
		}
	} )
	return ret
}

const speedtest = async () => {
	const feedback = await new Promise( resolve => {
		exec( 'npx speed-cloudflare-cli', ( error, stdout, stderr ) => {
			const ret = {}
			if ( error ) {
				ret.error = error.message
			}
			else if ( stderr ) {
				ret.error = stderr
			}
			else {
				const lines = stdout.split( '\n' ).map( l => l.replace( /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '' ).trim() ).filter( l => '' !== l ) // eslint-disable-line no-control-regex
				for ( let i = 0; i < lines.length; i++ ) {
					if ( lines[i].includes( ':' ) ) {
						const [ key, value ] = lines[i].split( ':' )
						ret[key.trim()] = value.trim()
					}
				}
			}
			resolve( ret )
		} )
	} )
	return feedback
}

module.exports = async () => {
	const ret = {
		version: ( '0.0.1' === pckg.version ) ? 'Development' : pckg.version,
		installation: ( process.env.containerized ) ? 'Docker' : 'NodeJS',
		architecture: process.arch,
		os: {
			type: os.type(),
			platform: os.platform(),
			release: os.release(),
			version: os.version()
		},
		cpus: getCPUInfo(),
		memory: prettyBytes( os.totalmem(), 1024 ),
		loads: Object.assign( {}, ...[ ...os.loadavg() ].map( ( v,i ) => {
			switch ( i ) {
				case 1: return { '5min': v }
				case 2: return { '15min': v }
				default: return { '1min': v }
			}
		} ) ),
		speed: await speedtest()
	}

	return ret
}