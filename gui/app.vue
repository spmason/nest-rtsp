<template>
  <v-app>
    <notifications group="errors" />
    <v-app-bar
      app
      elevation="1"
    >
      <v-toolbar-title>
        <v-icon
          class="mr-2"
          color="primary"
          large
        >
          mdi-home-automation
        </v-icon>
        <span>Nest RTSP</span>
      </v-toolbar-title>
      <v-spacer />
      <v-btn
        icon
        color="primary"
        href="https://nest-rtsp.jak.guru/"
        target="_blank"
      >
        <v-icon>mdi-lifebuoy</v-icon>
      </v-btn>
      <v-menu
        v-if="status.mqtt_settings"
        ref="mqttMenu"
        v-model="mqttMenu"
        offset-y
        :close-on-content-click="false"
      >
        <template #activator="{ on, attrs }">
          <v-btn
            :color="mqttColor"
            x-small
            dark
            v-bind="attrs"
            v-on="on"
          >
            MQTT
          </v-btn>
        </template>
        <v-list
          tag="form"
          action="#"
          method="POST"
          @submit="saveMQTT"
        >
          <v-list-item>
            <v-list-item-content>
              <v-text-field
                v-model="mqtt.host"
                clearable
                :disabled="!$api.connected || processing || mqtt.running"
                dense
                hide-details
                label="MQTT Host"
              />
            </v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>
              <v-text-field
                v-model="mqtt.user"
                clearable
                :disabled="!$api.connected || processing || mqtt.running"
                dense
                hide-details
                label="MQTT User"
              />
            </v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>
              <v-text-field
                v-model="mqtt.password"
                clearable
                :disabled="!$api.connected || processing || mqtt.running"
                dense
                hide-details
                label="MQTT Password"
              />
            </v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-switch
              v-model="mqtt.enabled"
              clearable
              :disabled="!$api.connected || processing || mqtt.running"
              dense
              hide-details
              label="Enabled"
            />
          </v-list-item>
          <v-list-item>
            <v-btn
              block
              small
              color="primary"
              dark
              :disabled="!$api.connected || processing || mqtt.running"
              @submit="saveMQTT"
              @click="saveMQTT"
            >
              Save
            </v-btn>
          </v-list-item>
          <v-divider />
          <v-list-item>
            <v-list-item-content>
              <div class="d-flex">
                <v-btn
                  fab
                  x-small
                  color="success"
                  class="elevation-1"
                  :disabled="!status.mqtt_settings.enabled || !$api.connected || processing || mqtt.running"
                  @click="startMQTT"
                >
                  <v-icon>mdi-play</v-icon>
                </v-btn>
                <v-spacer />
                <v-btn
                  fab
                  x-small
                  color="warning"
                  class="elevation-1"
                  :disabled="!status.mqtt_settings.enabled || !$api.connected || processing || !mqtt.running"
                  @click="restartMQTT"
                >
                  <v-icon>mdi-restart</v-icon>
                </v-btn>
                <v-spacer />
                <v-btn
                  fab
                  x-small
                  color="error"
                  class="elevation-1"
                  :disabled="!status.mqtt_settings.enabled || !$api.connected || processing || !mqtt.running"
                  @click="stopMQTT"
                >
                  <v-icon>mdi-stop</v-icon>
                </v-btn>
              </div>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-menu>
      <v-btn
        v-if="authenticated"
        icon
        color="error"
        :loading="processing"
        :disabled="!$api.connected"
        @click="logOutOfGoogle"
      >
        <v-icon>mdi-cancel</v-icon>
      </v-btn>
      <v-icon
        :color="$api.connected ? 'success' : 'error'"
        :title="$api.connected ? 'Connected' : 'Not Connected'"
        v-text="$api.connected ? 'mdi-lan-connect' : 'mdi-lan-disconnect'"
      />
    </v-app-bar>
    <v-main>
      <v-overlay
        color="primary"
        opacity="1"
        dark
        :value="!loaded"
      >
        <v-progress-circular
          indeterminate
          size="80"
          width="10"
        >
          <v-icon
            large
          >
            mdi-home-automation
          </v-icon>
        </v-progress-circular>
      </v-overlay>
      <v-container
        v-if="!authenticated"
        class="fill-height"
      >
        <v-row justify="center">
          <v-col
            cols="12"
            sm="6"
            md="4"
            lg="3"
          >
            <v-card color="grey lighten-5">
              <v-toolbar
                dense
                flat
                color="transparent"
              >
                <v-toolbar-title class="font-weight-bold">
                  Authentication Required
                </v-toolbar-title>
              </v-toolbar>
              <v-divider />
              <v-card-text>
                <p>In order to use Nest RTSP, you must log in using the Google account associated with your Nest account.</p>
                <v-btn
                  color="primary"
                  :loading="processing"
                  :disabled="!$api.connected"
                  @click="loginToGoogle"
                >
                  <v-icon class="mr-2">
                    mdi-google
                  </v-icon>
                  <span>Log In to Google</span>
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
      <v-container
        v-else
        class="fill-height"
      >
        <v-row>
          <v-col cols="12">
            <v-card
              color="grey lighten-5"
              elevation="1"
              tag="form"
              action="#"
              method="POST"
              @submit="saveAll"
            >
              <input
                type="submit"
                class="d-none"
              >
              <v-toolbar
                dense
                flat
                color="transparent"
              >
                <v-toolbar-title>
                  Cameras
                </v-toolbar-title>
                <v-spacer />
                <v-btn
                  color="primary"
                  small
                  icon
                  :disabled="devices.loading || !$api.connected"
                  class="mr-2"
                  @click="loginToPCM"
                >
                  <v-icon>mdi-home-lock-open</v-icon>
                </v-btn>
                <v-btn
                  small
                  icon
                  :disabled="devices.loading || !$api.connected"
                  @click="getDevices"
                >
                  <v-icon>mdi-refresh</v-icon>
                </v-btn>
              </v-toolbar>
              <v-progress-linear
                :indeterminate="devices.loading"
                :color="devices.loading ? 'primary' : 'grey darken-3'"
                height="1"
              />
              <v-card-text
                v-if="(!Array.isArray(devices.list) || devices.list.length === 0) && devices.loaded"
                class="pa-3"
              >
                <v-alert
                  type="info"
                  class="ma-0"
                >
                  <div>
                    <p><span>You do not have any cameras or you have not given permission to view their live streams via the Partner Connections Manager.</span></p>
                    <div>
                      <v-btn
                        color="primary darken-2"
                        :disabled="devices.loading || !$api.connected"
                        @click="loginToPCM"
                      >
                        Open Partner Connections Manager
                      </v-btn>
                    </div>
                  </div>
                </v-alert>
              </v-card-text>
              <v-data-table
                v-else
                :headers="headers"
                :items="cameras"
              >
                <!-- eslint-disable-next-line vue/valid-v-slot -->
                <template #item.type="{ item }">
                  <v-icon v-if="'sdm.devices.types.CAMERA' === item.type">
                    mdi-cctv
                  </v-icon>
                  <v-icon v-else-if="'sdm.devices.types.DOORBELL' === item.type">
                    mdi-doorbell-video
                  </v-icon>
                  <v-icon
                    v-else
                    color="error"
                  >
                    mdi-alert-circle
                  </v-icon>
                </template>
                <!-- eslint-disable-next-line vue/valid-v-slot -->
                <template #item.resolution="{ item }">
                  <code
                    v-if="item.resolution"
                    v-text="item.resolution.width"
                  />
                  <span v-if="item.resolution">×</span>
                  <code
                    v-if="item.resolution"
                    v-text="item.resolution.height"
                  />
                  <span v-if="!item.resolution">Not Reported</span>
                </template>
                <!-- eslint-disable-next-line vue/valid-v-slot -->
                <template #item.__rtsp="{ item }">
                  <v-text-field
                    v-model.number="rtsp_map[item.id]"
                    clearable
                    :disabled="!$api.connected || processing || item.running"
                    dense
                    hide-details
                    @change="saveRtspMapAfterTick"
                    @focus="onRTSPFocus(item.id)"
                    @blur="onRTSPBlur(item.id)"
                  />
                </template>
                <!-- eslint-disable-next-line vue/valid-v-slot -->
                <template #item.__path="{ item }">
                  <v-text-field
                    v-model.number="rtsp_paths[item.id]"
                    clearable
                    :disabled="!$api.connected || processing || item.running"
                    dense
                    hide-details
                    @change="saveRtspPathAfterTick"
                    @focus="onRTSPFocus(item.id)"
                    @blur="onRTSPBlur(item.id)"
                  />
                </template>
                <!-- eslint-disable-next-line vue/valid-v-slot -->
                <!-- <template #item.__status="{ item }">
                  <code>Unknown</code>
                </template> -->
                <!-- eslint-disable-next-line vue/valid-v-slot -->
                <template #item.__actions="{ item }">
                  <v-btn
                    fab
                    x-small
                    color="success"
                    class="elevation-1"
                    :disabled="!$api.connected || processing || item.running"
                    @click="startRTSP(item.id)"
                  >
                    <v-icon>mdi-play</v-icon>
                  </v-btn>
                  <v-btn
                    fab
                    x-small
                    color="warning"
                    class="elevation-1"
                    :disabled="!$api.connected || processing || !item.running"
                    @click="restartRTSP(item.id)"
                  >
                    <v-icon>mdi-restart</v-icon>
                  </v-btn>
                  <v-btn
                    fab
                    x-small
                    color="error"
                    class="elevation-1"
                    :disabled="!$api.connected || processing || !item.running"
                    @click="stopRTSP(item.id)"
                  >
                    <v-icon>mdi-stop</v-icon>
                  </v-btn>
                </template>
              </v-data-table>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import Vue from 'vue'
import merge from 'lodash.merge'
export default {
	data: () => ( {
		loaded: false,
		processing: false,
		status: {
			google_access_tokens: null,
			rtsp_map: {},
			rtsp_paths: {},
			mqtt_settings: {
				enabled: false,
				host: '',
				user: '',
				password: ''
			}
		},
		devices: {
			loading: false,
			loaded: false,
			list: []
		},
		rtsp_map: {},
		rtsp_paths: {},
		focused: null,
		processes: {},
		mqttMenu: false,
		mqtt: {
			running: false,
			enabled: false,
			host: '',
			user: '',
			password: ''
		}
	} ),
	computed: {
		authenticated() {
			return null !== this.status.google_access_tokens
		},
		cameras() {
			return [ ...this.devices.list ].map( c => {
				const ret = {
					id: c.name,
					type: c.type,
					room: c.parentRelations[0] ? c.parentRelations[0].displayName.trim() : 'None',
					name: c.traits['sdm.devices.traits.Info'].customName.trim(),
					resolution: c.traits['sdm.devices.traits.CameraLiveStream'].maxVideoResolution,
					status: ( 'undefined' !== typeof this.processes[c.name] ) ? this.processes[c.name] : 'Not Running',
					running: ( 'undefined' !== typeof this.processes[c.name] )
				}
				if ( 'string' !== typeof ret.name || 0 === ret.name.length ) {
					if ( 'None' === ret.room ) {
						ret.name = 'Unassigned Camera'
					}
					else {
						switch ( c.type ) {
							case 'sdm.devices.types.DOORBELL': ret.name = [ ret.room, 'Doorbell' ].join( ' ' ); break
							default: ret.name = [ ret.room, 'Camera' ].join( ' ' ); break
						}
						
					}
				}
				return ret
			} )
		},
		headers() {
			return [
				{
					text: '',
					value: 'type'
				},
				{
					text: 'Room',
					value: 'room'
				},
				{
					text: 'Name',
					value: 'name'
				},
				{
					text: 'Resolution',
					value: 'resolution'
				},
				// {
				// 	text: 'RTSP Port',
				// 	value: '__rtsp'
				// },
				{
					text: 'RTSP Path',
					value: '__path'
				},
				{
					text: 'Status',
					value: 'status'
				},
				{
					text: 'Actions',
					align: 'end',
					value: '__actions'
				}
			]
		},
		mqttColor() {
			switch ( true ) {
				case this.mqtt.running: return 'success'
				case !this.status.mqtt_settings: return 'grey darken-4'
				case !this.status.mqtt_settings.enabled: return 'grey darken-2'
				case this.status.mqtt_settings.enabled && !this.mqtt.running: return 'error'
				default: return 'grey darken-4'
			}
		}
	},
	watch: {
		authenticated( is ) {
			if ( is ) {
				this.getDevices()
			}
		},
		'status.rtsp_map'( latest ) {
			const update = merge( {}, this.rtsp_map, latest )
			for ( const key in update ) {
				if ( 'string' !== typeof this.focused || this.focused !== key ) {
					this.rtsp_map[key] = update[key]
				}
			}
		},
		'status.rtsp_paths'( latest ) {
			const update = merge( {}, this.rtsp_paths, latest )
			for ( const key in update ) {
				if ( 'string' !== typeof this.focused || this.focused !== key ) {
					this.rtsp_paths[key] = update[key]
				}
			}
		},
		'status.mqtt_settings'( latest ) {
			if ( !this.mqttMenu ) {
				const update = merge( {}, this.mqtt, latest )
				for ( const key in update ) {
					this.mqtt[key] = update[key]
				}
			}
		},
		'devices.list'( latest ) {
			if ( Array.isArray( latest ) ) {
				latest.forEach( c => {
					if ( 'undefined' === typeof this.rtsp_map[c.name] ) {
						this.rtsp_map[c.name] = null
					}
					if ( 'undefined' === typeof this.rtsp_paths[c.name] ) {
						this.rtsp_paths[c.name] = null
					}
				} )
			}
		}
	},
	mounted() {
		if ( 'string' === typeof window.location.search && 0 < window.location.search.length ) {
			window.location.href = [ window.location.origin, window.location.pathname ].join( '' )
		}
		this.$api.$on( 'status', this.onStatus )
		this.$api.$on( 'processes', this.onProcesses )
		this.$api.$on( 'mqtt', this.onMQTT )
		this.$api.$on( 'notification', this.onNotification )
	},
	beforeDestroy() {
		this.$api.$off( 'status', this.onStatus )
		this.$api.$off( 'processes', this.onProcesses )
		this.$api.$off( 'mqtt', this.onMQTT )
		this.$api.$off( 'notification', this.onNotification )
	},
	methods: {
		onNotification( payload ) {
			this.$notify( payload )
		},
		onStatus( status ) {
			this.loaded = true
			for ( const key in status ) {
				this.status[key] = ( 'object' === typeof status[key] && null !== status[key] ) ? Vue.observable( status[key] ) : status[key]
			}
		},
		onProcesses( processes ) {
			this.processes = processes
		},
		onMQTT( status ) {
			this.mqtt.running = status
		},
		onRTSPFocus( id ) {
			this.focused = id
		},
		onRTSPBlur() {
			this.focused = null
		},
		async loginToGoogle() {
			this.processing = true
			try {
				const url = await this.$api.request( 'gaurl' )
				if ( url instanceof Error ) {
					throw url
				}
				window.location.href = url
				this.processing = false
			}
			catch ( error ) {
				this.$notify( {
					group: 'errors',
					text: [ error.message, 'See console for more information' ].join( ' ' ),
					ignoreDuplicates: true
				} )
				console.error( error )
			}
		},
		async logOutOfGoogle() {
			this.processing = true
			try {
				const res = await this.$api.request( 'logout' )
				if ( res instanceof Error ) {
					throw res
				}
			}
			catch ( error ) {
				this.$notify( {
					group: 'errors',
					text: [ error.message, 'See console for more information' ].join( ' ' ),
					ignoreDuplicates: true
				} )
				console.error( error )
			}
			this.processing = false
		},
		async getDevices() {
			this.devices.loading = true
			try {
				const list = await this.$api.request( 'listDevices' )
				if ( list instanceof Error ) {
					throw list
				}
				this.devices.list = list
				this.devices.loaded = true
			}
			catch ( error ) {
				this.$notify( {
					group: 'errors',
					text: [ error.message, 'See console for more information' ].join( ' ' ),
					ignoreDuplicates: true
				} )
				console.error( error )
			}
			this.devices.loading = false
		},
		async loginToPCM() {
			this.processing = true
			let win = window.open( 'about:blank', 'Partner Connections Manager', '_blank' )
			let interval = setInterval( () => {
				if ( win.closed ) {
					clearInterval( interval )
					this.getDevices()
				}
			}, 500 )
			try {
				const url = await this.$api.request( 'pcmurl' )
				if ( url instanceof Error ) {
					win.close()
					throw url
				}
				win.location.href = url
				this.processing = false
			}
			catch ( error ) {
				this.$notify( {
					group: 'errors',
					text: [ error.message, 'See console for more information' ].join( ' ' ),
					ignoreDuplicates: true
				} )
				console.error( error )
			}
		},
		saveAll( e ) {
			if ( e ) {
				e.preventDefault()
				e.stopPropagation()
			}
			this.saveRtspMap()
			this.saveRtspPath()
		},
		async saveRtspMap( e ) {
			if ( e ) {
				e.preventDefault()
				e.stopPropagation()
			}
			this.processing = true
			try {
				const res = await this.$api.request( 'saveRTSP', this.rtsp_map )
				if ( res instanceof Error ) {
					throw res
				}
			}
			catch ( error ) {
				this.$notify( {
					group: 'errors',
					text: [ error.message, 'See console for more information' ].join( ' ' ),
					ignoreDuplicates: true
				} )
				console.error( error )
			}
			this.processing = false
		},
		saveRtspMapAfterTick() {
			this.$nextTick( this.saveRtspMap )
		},
		async saveRtspPath( e ) {
			if ( e ) {
				e.preventDefault()
				e.stopPropagation()
			}
			this.processing = true
			try {
				const res = await this.$api.request( 'saveRTSPPath', this.rtsp_paths )
				if ( res instanceof Error ) {
					throw res
				}
			}
			catch ( error ) {
				this.$notify( {
					group: 'errors',
					text: [ error.message, 'See console for more information' ].join( ' ' ),
					ignoreDuplicates: true
				} )
				console.error( error )
			}
			this.processing = false
		},
		saveRtspPathAfterTick() {
			this.$nextTick( this.saveRtspPath )
		},
		async startRTSP( id ) {
			if ( !this.rtsp_paths[id] || 'string' !== typeof this.rtsp_paths[id] || 0 === this.rtsp_paths[id].trim().length || !this.rtsp_paths[id].startsWith( '/' ) ) {
				this.$notify( {
					group: 'errors',
					text: 'The RTSP Path must begin with a "/"',
					ignoreDuplicates: true
				} )
				return false
			}
			this.processing = true
			try {
				const res = await this.$api.request( 'startRTSP', id )
				if ( res instanceof Error ) {
					throw res
				}
			}
			catch ( error ) {
				this.$notify( {
					group: 'errors',
					text: [ error.message, 'See console for more information' ].join( ' ' ),
					ignoreDuplicates: true
				} )
				console.error( error )
			}
			this.processing = false
		},
		async stopRTSP( id ) {
			this.processing = true
			try {
				const res = await this.$api.request( 'stopRTSP', id )
				if ( res instanceof Error ) {
					throw res
				}
			}
			catch ( error ) {
				this.$notify( {
					group: 'errors',
					text: [ error.message, 'See console for more information' ].join( ' ' ),
					ignoreDuplicates: true
				} )
				console.error( error )
			}
			this.processing = false
		},
		async restartRTSP( id ) {
			this.processing = true
			try {
				const res = await this.$api.request( 'restartRTSP', id )
				if ( res instanceof Error ) {
					throw res
				}
			}
			catch ( error ) {
				this.$notify( {
					group: 'errors',
					text: [ error.message, 'See console for more information' ].join( ' ' ),
					ignoreDuplicates: true
				} )
				console.error( error )
			}
			this.processing = false
		},
		async saveMQTT( e ) {
			if ( e ) {
				e.preventDefault()
				e.stopPropagation()
			}
			this.processing = true
			try {
				const u = Object.assign( {}, this.mqtt )
				delete u.running
				const res = await this.$api.request( 'saveMQTT', u )
				if ( res instanceof Error ) {
					throw res
				}
			}
			catch ( error ) {
				this.$notify( {
					group: 'errors',
					text: [ error.message, 'See console for more information' ].join( ' ' ),
					ignoreDuplicates: true
				} )
				console.error( error )
			}
			this.processing = false
		},
		async startMQTT() {
			this.processing = true
			try {
				const res = await this.$api.request( 'startMQTT' )
				if ( res instanceof Error ) {
					throw res
				}
			}
			catch ( error ) {
				this.$notify( {
					group: 'errors',
					text: [ error.message, 'See console for more information' ].join( ' ' ),
					ignoreDuplicates: true
				} )
				console.error( error )
			}
			this.processing = false
		},
		async restartMQTT() {
			this.processing = true
			try {
				const res = await this.$api.request( 'restartMQTT' )
				if ( res instanceof Error ) {
					throw res
				}
			}
			catch ( error ) {
				this.$notify( {
					group: 'errors',
					text: [ error.message, 'See console for more information' ].join( ' ' ),
					ignoreDuplicates: true
				} )
				console.error( error )
			}
			this.processing = false
		},
		async stopMQTT() {
			this.processing = true
			try {
				const res = await this.$api.request( 'stopMQTT' )
				if ( res instanceof Error ) {
					throw res
				}
			}
			catch ( error ) {
				this.$notify( {
					group: 'errors',
					text: [ error.message, 'See console for more information' ].join( ' ' ),
					ignoreDuplicates: true
				} )
				console.error( error )
			}
			this.processing = false
		}
	}
}
</script>