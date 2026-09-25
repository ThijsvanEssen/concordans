import type { components } from './generated/openapi-types';

/** A response or request shape of the API, named as in the schema. */
export type Schema<Name extends keyof components['schemas']> = components['schemas'][Name];
