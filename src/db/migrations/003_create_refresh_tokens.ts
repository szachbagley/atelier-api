import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
    table.specificType('user_id', 'CHAR(36)').notNullable();
    table.string('token_hash', 64).notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('revoked_at').nullable().defaultTo(null);
    table.specificType('replaced_by_id', 'CHAR(36)').nullable();
    table.string('user_agent', 512).nullable();
    table.string('ip_address', 45).nullable();

    table
      .foreign('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.index(['user_id'], 'idx_user_tokens');
    table.index(['expires_at'], 'idx_expires');
    table.index(['token_hash'], 'idx_token_hash');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('refresh_tokens');
}
