import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('projects', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
    table.specificType('user_id', 'CHAR(36)').notNullable();
    table.string('title', 255).notNullable();
    table.specificType('share_token', 'CHAR(36)').unique().nullable();
    table.boolean('is_public').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable().defaultTo(null);

    table
      .foreign('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.index(['user_id'], 'idx_user_projects');
    table.index(['share_token'], 'idx_share_token');
    table.index(['deleted_at'], 'idx_deleted');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('projects');
}
