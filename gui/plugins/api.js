import shortid from 'shortid'
import { io } from 'socket.io-client'

class ApiPlugin {
	#instance
	#client

	constructor( Vue ) {
		const parent = this
		const reserved = Vue.observable( {
			connected: null
		} )
		this.#client = io()
		this.#client.on( 'connect', () => {
			reserved.connected = true
		} )
		this.#client.on( 'disconnect', () => {
			reserved.connected = false
		} )
		this.#instance = new Vue( {
			computed: {
				connected() {
					return reserved.connected
				}
			},
			created() {
				parent.client.on( 'status', payload => {
					this.$emit( 'status', payload )
				} )
				parent.client.on( 'processes', payload => {
					this.$emit( 'processes', payload )
				} )
				parent.client.on( 'mqtt', payload => {
					this.$emit( 'mqtt', payload )
				} )
				parent.client.on( 'notification', payload => {
					this.$emit( 'notification', payload )
				} )
			},
			methods: {
				async request( cmd = 'ping', args = null, timeout = 10000 ) {
					try {
						const id = shortid.generate()
						const payload = {
							id,
							cmd,
							args,
							timeout: timeout ? timeout - 1 : undefined
						}
						const resp = new Promise( ( resolve, reject ) => {
							parent.client.once( `response-${id}`, resolve )
							parent.client.once( `error-${id}`, reject )
						} )
						const racer = [ resp ]
						parent.client.emit( 'request', payload )
						if ( 0 < parseInt( timeout ) ) {
							racer.push( new Promise( ( resolve, reject ) => {
								setTimeout( reject, timeout, new Error( 'Timeout' ) )
							} ) )
						}
						return Promise.race( racer ).catch( err => {
							if ( 'string' === typeof err ) {
								return new Error( err )
							}
							return err
						} )
					}
					catch ( error ) {
						return error
					}
				}
			}
		} )
	}

	get instance() {
		return this.#instance
	}

	get client() {
		return this.#client
	}

	static install ( Vue, opts ) {
		const instance = new this( Vue, opts )
		Vue.prototype.$api = instance.instance
	}
}

export default ApiPlugin