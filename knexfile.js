// Update with your config settings.
const { configuration } = require( './src' )
/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
const config = configuration.get( 'database' )
module.exports = config
