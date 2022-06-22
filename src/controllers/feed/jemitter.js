const { EventEmitter } = require( 'events' )
const { createCanvas, Image } = require( 'canvas' )

class JpegFrameEmitter extends EventEmitter {
	#interval
	#framesPerSecond
	#jpeg
	#width = 800
	#height = 600

	constructor( framesPerSecond = 5, width = 800, height = 600 ) {
		super()
		this.#framesPerSecond = framesPerSecond
		this.#width = width
		this.#height = height
		// set a blank screen
		this.#setBlankScreen.apply( this )
	}

	start() {
		const timeout = 1000 / parseInt( this.#framesPerSecond )
		this.#interval = setInterval( () => {
			this.emit( 'jpeg', this.#jpeg )
		}, timeout )
	}

	stop() {
		clearInterval( this.#interval )
	}

	get jpeg() {
		return this.#jpeg
	}

	set jpeg( val ) {
		this.#jpeg = val
		this.emit( 'update', this.#jpeg )
	}

	update ( buffer ) {
		this.jpeg = buffer
	}

	write( base64Png ) {
		const width = this.#width
		const height = this.#height
		const canvas = createCanvas( width, height )
		const context = canvas.getContext( '2d' )
		context.fillStyle = '#FFFFFF'
		context.fillRect( 0, 0, width, height )
		const pngsrc = [ 'data:image/jpeg;base64', base64Png ].join( ',' )
		const img = new Image()
		img.src = pngsrc
		context.drawImage( img, 0, 0 )
		this.jpeg = canvas.toBuffer( 'image/jpeg' )
	}

	#setBlankScreen = function() {
		const width = this.#width
		const height = this.#height
		const canvas = createCanvas( width, height )
		const context = canvas.getContext( '2d' )
		context.fillStyle = '#17335b'
		context.fillRect( 0, 0, width, height )
		this.#jpeg = canvas.toBuffer( 'image/jpeg' )
	}
}

module.exports = JpegFrameEmitter
