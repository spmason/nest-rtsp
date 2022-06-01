/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function( knex ) {
	return knex.schema.createTable( 'settings', function ( table ) {
		table.string( 'key' )
		table.text( 'value' )
	} )
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function( knex ) {
	return knex.schema.dropTableIfExists( 'settings' )
}
