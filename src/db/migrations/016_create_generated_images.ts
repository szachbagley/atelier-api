import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('generated_images', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
    table.specificType('project_id', 'CHAR(36)').notNullable();
    table.string('s3_key', 512).notNullable();
    table.text('prompt').nullable();
    table.string('provider', 50).nullable();
    table.string('model', 100).nullable();
    table.integer('width').nullable();
    table.integer('height').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable().defaultTo(null);

    table
      .foreign('project_id')
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
    table.index(['project_id'], 'idx_project_images');
    table.index(['deleted_at'], 'idx_deleted');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('generated_images');
}
