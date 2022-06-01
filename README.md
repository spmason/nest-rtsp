# Nest RTSP Manager

Uses Google's [Smart Device Managemement](https://developers.google.com/nest/device-access) API's to provide an RTSP feed which can be consumed by other RTSP clients such as VLC, Home Assistant, Frigate etc.

# Before you Start

This project requires that you have a [Device Access Console](https://console.nest.google.com/device-access/) account which may require payment.

# Prelaunch Configuration / Requirements

This project was developed on NodeJS 16.14.0. To attempt to reduce possible issues, the project has been pinned to using NodeJS 16.x.x.

You will need the following information before you can launch the project:

| Description | Environmental Variable Name | Link |
| ---- | --- | --- |
| OAuth Client ID | `GA_OAUTH_CID` | [Google Cloud Platform Developers Console](https://console.cloud.google.com/apis/credentials) |
| OAuth Client Secret | `GA_OAUTH_CS` | [Google Cloud Platform Developers Console](https://console.cloud.google.com/apis/credentials) |
| SDM Project ID |  `GA_SDM_PID` | [Device Access Console](https://console.nest.google.com/device-access/) |

**Note** Your Google Authentication credentials must have access to the [Smart Device Management API](https://developers.google.com/nest/device-access?hl=en_US)

## Additional Configuration Options

The following can also be configured by changing values of environmental variables

| Description | Environmental Variable | Default |
| --- | --- | --- |
| HTTP GUI Port | `HTTP_PORT` | `3000` |
| RTSP Port which will be published for clients | `RTSP_CLIENT_PORT` | `554` |
| RTSP Port which ffmpeg will stream to | `RTSP_SERVER_PORT` | `6554` |
| RTSP RTP Port Start | `RTSP_RTP_START` | `10000` |
| RTSP RTP Port Count | `RTSP_RTP_COUNT` | `10000` |
| [Knex.js Configuration](http://knexjs.org/guide/#configuration-options) | `DB_CONFIG` | `"{\"client\":\"better-sqlite3\",\"connection\":{\"filename\":\"{{BASE}}/nest-rtsp.sqlite\"}}"` |
| Google OAuth Redirect URL | `GA_OAUTH_RDR` | `http://localhost:3000` |

# Acknowledgements

* [rtsp-streaming-server](https://github.com/chriswiggins/rtsp-streaming-server)(*)

(*) Used with modifications


# Disclaimer

While this project uses Google's SDM API, it is not associated with Google, Nest or any other brand listed on this page. As noted in the license:

```
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

Basically, use at your own Risk.