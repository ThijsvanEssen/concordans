import type { components, paths } from './generated/openapi-types';

/** A response or request shape of the API, named as in the schema. */
export type Schema<Name extends keyof components['schemas']> = components['schemas'][Name];

/** The query parameters of a GET route, as the schema names them. */
export type QueryOf<P extends keyof paths> = NonNullable<
	paths[P] extends { get: { parameters: { query?: infer Q } } } ? Q : never
>;
