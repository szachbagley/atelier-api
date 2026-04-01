import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shot_characters', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
    table.specificType('shot_id', 'CHAR(36)').notNullable();
    table.specificType('character_id', 'CHAR(36)').notNullable();
    table.specificType('variant_id', 'CHAR(36)').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table
      .foreign('shot_id')
      .references('id')
      .inTable('shots')
      .onDelete('CASCADE');
    table
      .foreign('character_id')
      .references('id')
      .inTable('characters')
      .onDelete('CASCADE');
    table
      .foreign('variant_id')
      .references('id')
      .inTable('variants')
      .onDelete('SET NULL');
    table.unique(['shot_id', 'character_id'], {
      indexName: 'unique_shot_character',
    });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('shot_characters');
}
