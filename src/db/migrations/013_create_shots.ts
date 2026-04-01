import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shots', (table) => {
    table.specificType('id', 'CHAR(36)').primary();
    table.specificType('scene_id', 'CHAR(36)').notNullable();
    table.integer('sequence_number').notNullable().defaultTo(1000);
    table.text('description').nullable();
    table
      .enum('shot_type', [
        'EWS',
        'WS',
        'FS',
        'MWS',
        'MS',
        'MCU',
        'CU',
        'ECU',
        'OTS',
        'POV',
        'TWO_SHOT',
        'INSERT',
        'ESTABLISHING',
      ])
      .nullable();
    table
      .enum('camera_angle', [
        'EYE_LEVEL',
        'LOW_ANGLE',
        'HIGH_ANGLE',
        'BIRDS_EYE',
        'DUTCH_ANGLE',
        'WORMS_EYE',
      ])
      .nullable();
    table
      .enum('camera_movement', [
        'STATIC',
        'PAN',
        'TILT',
        'DOLLY',
        'CRANE',
        'HANDHELD',
        'ZOOM',
      ])
      .nullable();
    table.specificType('setting_id', 'CHAR(36)').nullable();
    table.specificType('lighting_id', 'CHAR(36)').nullable();
    table.specificType('generated_image_id', 'CHAR(36)').nullable();
    table.specificType('previous_image_id', 'CHAR(36)').nullable();
    table.json('annotations').nullable();
    table.text('caption').nullable();
    table.text('compiled_prompt').nullable();
    table.text('edited_prompt').nullable();
    table
      .enum('status', ['DRAFT', 'GENERATING', 'GENERATED', 'FAILED'])
      .defaultTo('DRAFT');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable().defaultTo(null);

    table
      .foreign('scene_id')
      .references('id')
      .inTable('scenes')
      .onDelete('CASCADE');
    table
      .foreign('setting_id')
      .references('id')
      .inTable('settings')
      .onDelete('SET NULL');
    table
      .foreign('lighting_id')
      .references('id')
      .inTable('lighting_setups')
      .onDelete('SET NULL');
    table.index(['scene_id'], 'idx_scene_shots');
    table.index(['scene_id', 'sequence_number'], 'idx_sequence');
    table.index(['deleted_at'], 'idx_deleted');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('shots');
}
