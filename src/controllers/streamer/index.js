const { exec } = require( 'child_process' )

const streamOut = ( src, port = 554, path = '/' ) => {
	const args = [
		'ffmpeg',
		// '-v verbose',
		'-loglevel warning',
		'-re',
		`-i "${src}"`,
		'-f rtsp',
		'-hide_banner',
		'-avoid_negative_ts make_zero',
		'-fflags +genpts+discardcorrupt',
		'-rtsp_transport udp',
		'-use_wallclock_as_timestamps 1',
		'-c copy',
		`rtsp://127.0.0.1:${port}${path}`
	]
	const cmd = args.join( ' ' )
	const fp = exec( cmd, {} )
	return { cmd, fp }
}

module.exports = {
	streamOut
}