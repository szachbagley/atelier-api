import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('variants', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
    table.specificType('character_id', 'CHAR(36)').notNullable();
    table.string('name', 255).notNullable();
    table.text('description').nullable();
    table.text('ai_description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable().defaultTo(null);

    table
      .foreign('character_id')
      .references('id')
      .inTable('characters')
      .onDelete('CASCADE');
    table.index(['character_id'], 'idx_character_variants');
    table.index(['deleted_at'], 'idx_deleted');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('variants');
}
