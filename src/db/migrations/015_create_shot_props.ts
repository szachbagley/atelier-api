import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shot_props', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
    table.specificType('shot_id', 'CHAR(36)').notNullable();
    table.specificType('prop_id', 'CHAR(36)').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table
      .foreign('shot_id')
      .references('id')
      .inTable('shots')
      .onDelete('CASCADE');
    table
      .foreign('prop_id')
      .references('id')
      .inTable('props')
      .onDelete('CASCADE');
    table.unique(['shot_id', 'prop_id'], {
      indexName: 'unique_shot_prop',
    });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('shot_props');
}
