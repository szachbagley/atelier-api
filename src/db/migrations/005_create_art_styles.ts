import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('art_styles', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
    table.specificType('project_id', 'CHAR(36)').unique().notNullable();
    table.string('name', 255).nullable();
    table.text('description').nullable();
    table.text('color_palette').nullable();
    table.text('style_references').nullable();
    table.json('technical_terms').nullable();
    table.text('ai_description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable().defaultTo(null);

    table
      .foreign('project_id')
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
    table.index(['deleted_at'], 'idx_deleted');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('art_styles');
}
