const { EventEmitter } = require( 'events' )
const debug = require( 'debug' )
const puppeteer = require( 'puppeteer-extra' )
const pluginStealth = require( 'puppeteer-extra-plugin-stealth' )
const ppUserPrefs = require( 'puppeteer-extra-plugin-user-preferences' )
const UserAgent = require( 'user-agents' )
const clc = require( 'cli-color' )
const { inspect } = require( 'util' )
const chromePaths = require( 'chrome-paths' )

const dbg = debug( 'nest-rtsp:browser' )

puppeteer.use( pluginStealth() )
puppeteer.use(
	ppUserPrefs( {
		userPrefs: {
			devtools: {
				preferences: {
					'network_log.preserve-log': '"true"',
					'console.preserve-log': '"true"'
				}
			}
		}
	} )
)

class Browser extends EventEmitter{
	#browser
	#page

	#userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36'
	#tz = 'America/New_York'
	#language = 'en-US'

	#images = new Map()

	#width = 640
	#height = 480

	constructor( webRTCConfig ) {
		super()
		if ( 'object' === typeof webRTCConfig && null !== webRTCConfig ) {
			this.#width = webRTCConfig.width
			this.#height = webRTCConfig.height
		}
	}

	get page() {
		return this.#page
	}

	get images() {
		return this.#images
	}

	#cfg = () => ( {
		headless: true,
		args: this.#args.apply( this ),
		ignoreHTTPSErrors: true,
		devtools: false,
		defaultViewPort: {
			width: this.#width,
			height: this.#height
		},
		executablePath: chromePaths.chrome
	} )

	#args = () => ( [
		'--no-sandbox',
		'--disable-setuid-sandbox',
		'--disable-infobars',
		'--window-position=0,0',
		'--ignore-certifcate-errors',
		'--ignore-certifcate-errors-spki-list',
		'--disable-dev-shm-usage',
		'--disable-notifications',
		`--window-size=${this.#width},${this.#height}`,
		`--user-agent="${this.#userAgent}"`,
		'--enable-features=NetworkService',
		'--disk-cache-size=0',
		'--enable-usermedia-screen-capturing'
	] )

	#onNewPage = async function( page ) {
		dbg( 'Setting up new page' )
		if ( !page ) {
			dbg( 'No Page. Returning' )
			return
		}
		let UA
		try {
			UA = new UserAgent( this.#userAgent )
		}
		catch {
			UA = new UserAgent( [
				{ deviceCategory: 'desktop' }
			] )
		}
		dbg( `Got UA ${UA.toString()}` )
		// Tell the browser to let us do what we are doing here
		await page.setBypassCSP( true )
		await page.setRequestInterception( true )
		const client = page._client()
		// Disable service workers
		if ( client && 'function' === typeof client.send ) {
			client.on( 'Page.screencastFrame', ( { data, sessionId } ) => {
				this.emit( 'screenshot', data, sessionId, page )
				this.#images.set( sessionId, data )
				client.send( 'Page.screencastFrameAck', { sessionId } ).catch( () => {} )
			} )
			await client.send( 'ServiceWorker.disable' )
		}
		else {
			dbg( 'Could not find page client!!!' )
			dbg( inspect( client, true, 4, true ) )
		}
		// Setup the navigator / browser to look more authentic by setting the navigator vendor, platform and getting rid of the webdriver
		await page.evaluateOnNewDocument( UA => {
			const newProto = navigator.__proto__
			delete newProto.webdriver
			navigator.__proto__ = newProto
			Object.defineProperty( navigator, 'vendor', {
				get: function() {
					return UA.vendor
				}
			} )
			Object.defineProperty( navigator, 'platform', {
				get: function() {
					return UA.platform
				}
			} )
			delete navigator.webdriver
		}, UA.data )
		// MAKE SURE that we're sendign the correct User Agent
		await page.setUserAgent( this.#userAgent )
		// On Page Request, ensure that we've updated the headers appropriately
		page.on( 'request', async request => {
			if ( !request.isNavigationRequest() ) {
				request.continue()
				return
			}
			const headers = request.headers()
			headers['Accept-Language'] = `${this.#language};q=9`
			headers['User-Agent'] = this.#userAgent
			try {
				request.continue( { headers } )
			}
			catch ( err ) {
				dbg( `Failed to make page request due to error: ${err.message}` )
				request.continue()
			}
		} )
		// Try to tell the browser to emulate the chosen timezone
		try {
			page.emulateTimezone( this.#tz )
		}
		catch {
			dbg( 'Failed to update timezone' )
		}
		// Forward logs to console
		page.on( 'console', message => dbg( `${clc.bgCyan.yellowBright( '[CONSOLE]' )} ${message.type().substr( 0, 3 ).toUpperCase()} ${message.text()}` ) )
		page.on( 'pageerror', ( { message } ) => dbg( `${clc.bgCyan.yellowBright( '[CONSOLE]' )} ${message}` ) )
		// Expose a function called "emitFatality"
		page.exposeFunction( 'emitFatality', ( ...args ) => {
			this.emit( 'fatality', ...args )
		} )
		page.exposeFunction( 'emitReady', ( ...args ) => {
			this.emit( 'ready', ...args )
		} )
		page.exposeFunction( 'inspect', ( ...args ) => {
			dbg( `${clc.bgYellowBright.black( '[INSPECT]' )} ${inspect( [ ...args ], true, 5, true )}` )
		} )
	}

	async init() {
		this.#browser = await puppeteer.launch( this.#cfg.apply( this ) )
		this.#browser.on( 'targetcreated', async target => {
			const page = await target.page()
			try {
				await this.#onNewPage.apply( this, [ page ] )
			}
			catch ( e ) {
				dbg( `Failed to setup new page due to error: ${e.message}` )
			}
		} )
		const pages = await this.#browser.pages()
		await Promise.all( pages.map( async p => this.#onNewPage.apply( this, [ p ] ) ) )
		if ( 0 < pages.length ) {
			this.#page = pages[0]
		}
		else {
			this.#page = await this.#browser.newPage()
		}
	}

	async close() {
		try {
			await this.#browser.close()
		}
		catch {
			// do nothing
		}
	}

	async startStream() {
		dbg( 'Starting Screencast' )
		const client = this.#page._client()
		if ( client && 'function' === typeof client.send ) {
			await client.send( 'Page.startScreencast', {
				format: 'jpeg',
				quality: 100,
				maxWidth: this.#width,
				maxHeight: this.#height
			} )
		}
		dbg( 'Started Screencast' )
	}

	async stopStream() {
		dbg( 'Stopping Screencast' )
		const client = this.#page._client()
		if ( client && 'function' === typeof client.send ) {
			await client.send( 'Page.stopScreencast' )
		}
		dbg( 'Stopped Screencast' )
	}

	static async launch( webRTCConfig ) {
		const obj = new this( webRTCConfig )
		await obj.init()
		return obj
	}
}

module.exports = Browser