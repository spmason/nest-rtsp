const EventEmitter = require( 'events' )
const RTSPS = require( '../../../libs/rtsp-streaming-server' ).default

class RTSPServer extends EventEmitter {
	#client
	#server
	#start
	#count
	#provider
	#mounts = new Set()

	constructor( { client, server, start, count } ) {
		super()
		this.#client = client
		this.#server = server
		this.#start = start
		this.#count = count
		this.#provider = new RTSPS( {
			clientPort: parseInt( this.#client ),
			serverPort: parseInt( this.#server ),
			rtpPortStart: parseInt( this.#start ),
			rtpPortCount: parseInt( this.#count ),
			publishServerHooks: {
				checkMount: this.#serverCheckMount.bind( this )
			},
			clientServerHooks: {
				checkMount: this.#clientCheckMount.bind( this )
			}
		} )
	}

	get ports() {
		return {
			client: this.#client,
			server: this.#server
		}
	}

	// #clientCheckMount = async function( req ) {
	// 	const url = new URL( req.uri )
	// 	return ( this.#mounts.has( url.pathname ) ) ? true : 404
	// }

	#clientCheckMount = () => true

	#serverCheckMount = () => true

	async start() {
		return await this.#provider.start()
	}

	add( path ) {
		this.#mounts.add( path )
	}

	remove( path ) {
		this.#mounts.delete( path )
	}

	static async init( port ) {
		const obj = new this( port )
		await obj.start()
		return obj
	}
}

module.exports = RTSPServer