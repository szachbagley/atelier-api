import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('concept_art_sessions', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
    table.specificType('project_id', 'CHAR(36)').notNullable();
    table
      .enum('component_type', [
        'character',
        'variant',
        'setting',
        'prop',
        'lighting',
        'art_style',
      ])
      .notNullable();
    table.specificType('component_id', 'CHAR(36)').nullable();
    table
      .enum('status', ['ACTIVE', 'COMPLETED', 'ABANDONED'])
      .defaultTo('ACTIVE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable().defaultTo(null);

    table
      .foreign('project_id')
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
    table.index(['project_id'], 'idx_project_sessions');
    table.index(['deleted_at'], 'idx_deleted');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('concept_art_sessions');
}
