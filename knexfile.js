// Update with your config settings.
const { providers } = require( './src' )
/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
const config = providers.configuration.get( 'database' )
module.exports = config
