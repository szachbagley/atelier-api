import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('scenes', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
    table.specificType('act_id', 'CHAR(36)').notNullable();
    table.string('title', 255).notNullable();
    table.integer('sequence_number').notNullable().defaultTo(1000);
    table.specificType('default_setting_id', 'CHAR(36)').nullable();
    table.specificType('default_lighting_id', 'CHAR(36)').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable().defaultTo(null);

    table
      .foreign('act_id')
      .references('id')
      .inTable('acts')
      .onDelete('CASCADE');
    table
      .foreign('default_setting_id')
      .references('id')
      .inTable('settings')
      .onDelete('SET NULL');
    table
      .foreign('default_lighting_id')
      .references('id')
      .inTable('lighting_setups')
      .onDelete('SET NULL');
    table.index(['act_id'], 'idx_act_scenes');
    table.index(['act_id', 'sequence_number'], 'idx_sequence');
    table.index(['deleted_at'], 'idx_deleted');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('scenes');
}
