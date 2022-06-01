module.exports = {
	client: process.env.RTSP_CLIENT_PORT || 554,
	server: process.env.RTSP_SERVER_PORT || 6554,
	start: process.env.RTSP_RTP_START || 10000,
	count: process.env.RTSP_RTP_COUNT || 10000
}