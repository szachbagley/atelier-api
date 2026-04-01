import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('lighting_setups', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
    table.specificType('project_id', 'CHAR(36)').notNullable();
    table.string('name', 255).notNullable();
    table.text('description').nullable();
    table.text('mood').nullable();
    table.text('ai_description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable().defaultTo(null);

    table
      .foreign('project_id')
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
    table.index(['project_id'], 'idx_project_lighting');
    table.index(['deleted_at'], 'idx_deleted');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('lighting_setups');
}
