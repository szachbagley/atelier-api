import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_api_keys', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
    table.specificType('user_id', 'CHAR(36)').notNullable();
    table
      .enum('provider', ['gemini', 'openai', 'stability', 'midjourney'])
      .notNullable();
    table.text('encrypted_key').notNullable();
    table.string('key_hint', 10).nullable();
    table.boolean('is_valid').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable().defaultTo(null);

    table
      .foreign('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.unique(['user_id', 'provider'], {
      indexName: 'unique_user_provider',
    });
    table.index(['deleted_at'], 'idx_deleted');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_api_keys');
}
