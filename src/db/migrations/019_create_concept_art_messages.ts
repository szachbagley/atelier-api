import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('concept_art_messages', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
    table.specificType('session_id', 'CHAR(36)').notNullable();
    table.enum('role', ['user', 'assistant', 'system']).notNullable();
    table.text('content').nullable();
    table.specificType('generated_image_id', 'CHAR(36)').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table
      .foreign('session_id')
      .references('id')
      .inTable('concept_art_sessions')
      .onDelete('CASCADE');
    table
      .foreign('generated_image_id')
      .references('id')
      .inTable('generated_images')
      .onDelete('SET NULL');
    table.index(['session_id'], 'idx_session_messages');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('concept_art_messages');
}
