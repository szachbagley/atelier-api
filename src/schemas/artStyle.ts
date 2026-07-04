import Joi from 'joi';

// One art style per project; PUT upserts. All fields optional — the default
// row is created empty alongside the project.
export const updateArtStyleSchema = Joi.object({
  name: Joi.string().trim().max(255).allow('', null),
  description: Joi.string().max(10000).allow('', null),
  colorPalette: Joi.string().max(10000).allow('', null),
  styleReferences: Joi.string().max(10000).allow('', null),
  technicalTerms: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .max(50)
    .allow(null),
  aiDescription: Joi.string().max(10000).allow('', null),
}).min(1);
