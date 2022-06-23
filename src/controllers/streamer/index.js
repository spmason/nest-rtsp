const { exec } = require( 'child_process' )

const streamOut = ( src, port = 554, path = '/' ) => {
	const args = [
		'ffmpeg',
		'-loglevel warning',
		'-re',
		'-avoid_negative_ts make_zero',
		`-i "${src}"`,
		'-f rtsp',
		'-hide_banner',
		'-avoid_negative_ts make_zero',
		'-fflags +genpts+discardcorrupt',
		'-rtsp_transport udp',
		'-use_wallclock_as_timestamps 1',
		'-vsync 0',
		'-enc_time_base -1',
		'-err_detect ignore_err',
		'-c copy',
		`rtsp://127.0.0.1:${port}${path}`
	]
	const cmd = args.join( ' ' )
	const fp = exec( cmd, {
		maxBuffer: 10486750
	} )
	return { cmd, fp }
}

const streamMJPEG = ( src, port = 554, path = '/' ) => {
	const args = [
		'ffmpeg',
		'-loglevel warning',
		'-re',
		'-avoid_negative_ts make_zero',
		'-fflags nobuffer',
		'-flags low_delay',
		'-strict experimental',
		'-fflags +genpts+discardcorrupt',
		'-use_wallclock_as_timestamps 1',
		`-i "${src}"`,
		'-f rtsp',
		'-hide_banner',
		'-avoid_negative_ts make_zero',
		'-fflags +genpts+discardcorrupt',
		'-rtsp_transport udp',
		'-use_wallclock_as_timestamps 1',
		'-vsync 0',
		'-enc_time_base -1',
		'-err_detect ignore_err',
		'-c:v libx264',
		'-an',
		`rtsp://127.0.0.1:${port}${path}`
	]
	const cmd = args.join( ' ' )
	const fp = exec( cmd, {
		maxBuffer: 10486750
	} )
	return { cmd, fp }
}

module.exports = {
	streamOut,
	streamMJPEG
}