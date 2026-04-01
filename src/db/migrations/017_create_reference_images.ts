import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('reference_images', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
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
    table.specificType('component_id', 'CHAR(36)').notNullable();
    table.string('s3_key', 512).notNullable();
    table.string('filename', 255).nullable();
    table.string('mime_type', 100).nullable();
    table.timestamp('uploaded_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable().defaultTo(null);

    table.index(['component_type', 'component_id'], 'idx_component');
    table.index(['deleted_at'], 'idx_deleted');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('reference_images');
}
