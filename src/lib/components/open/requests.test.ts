import { describe, expect, it } from 'vitest';
import { ApiError } from '$lib/api/client';
import { fail, fakeApi } from '$lib/test/fakeApi';
import { createLoader, type LoadState } from '$lib/util/load.svelte';
import { changesOf, postRecord, rowText, type PostRecord } from './requests';
import type { MetInhoud } from './rij-inhoud';

const signal = () => new AbortController().signal;
const settle = () => new Promise((r) => setTimeout(r));

const motie: MetInhoud = {
	kind: 'Motie',
	node: { collection: 'documents', key: 'motie_1' },
	summary: null,
	vote: null
};

describe('the text of an opened row', () => {
	it('fails as a failure, never as "Tekst nog niet in de gegevens"', async () => {
		fakeApi({ '/api/documents/{key}': fail(500) });
		await expect(rowText(motie, 'dictum', signal())).rejects.toBeInstanceOf(ApiError);
	});

	it('is none where the API does not have the paper', async () => {
		fakeApi({ '/api/documents/{key}': fail(404) });
		expect(await rowText(motie, 'dictum', signal())).toEqual({ text: null, as: 'dictum' });
	});

	it('reads the dictum the API gives', async () => {
		fakeApi({ '/api/documents/{key}': { kind: 'Motie', dictum: 'verzoekt de regering' } });
		expect(await rowText(motie, 'dictum', signal())).toEqual({
			text: 'verzoekt de regering',
			as: 'dictum'
		});
	});
});

describe('the changes of an opened publication', () => {
	const publicatie: MetInhoud = {
		kind: 'publicatie',
		node: { collection: 'instruments', key: 'stb_2026_1' },
		summary: null,
		vote: null,
		publication: { series: null, year: null, number: null, citation: null, instruments: [] }
	};

	it('fails as a failure, never as "Wijzigingen niet in de gegevens"', async () => {
		fakeApi({ '/api/nodes/{collection}/{key}': fail(500) });
		await expect(changesOf(publicatie, 'wijzigingen', signal())).rejects.toBeInstanceOf(ApiError);
	});

	it('fails as a failure for an inwerkingtreding too', async () => {
		fakeApi({ '/api/instruments/{bwb_id}/amended-by': fail(503) });
		const inwerking = {
			...publicatie,
			date: '2026-10-01',
			commencement: { instrument: { key: 'bwbr0001854' } }
		} as never;
		await expect(changesOf(inwerking, 'inwerkingtreding', signal())).rejects.toBeInstanceOf(
			ApiError
		);
	});
});

describe('the record of an opened post', () => {
	const commitments = (total: number) => ({
		items: [],
		total,
		facets: { status: [{ value: 'Openstaand', count: 1 }] }
	});
	const authored = (n: number, total = n) => ({
		node: { id: 'members/a', key: 'a', collection: 'members' },
		neighbors: {
			buckets: [
				{
					relation: 'AUTHORED',
					direction: 'outbound',
					collection: 'documents',
					total,
					items: Array.from({ length: n }, (_, i) => ({
						id: `documents/d${i}`,
						key: `d${i}`,
						collection: 'documents',
						props: { date: '2026-10-01' }
					}))
				}
			]
		}
	});

	it('fails as a failure, never as "0 stukken ondertekend"', async () => {
		fakeApi({
			'/api/commitments': commitments(2),
			'/api/nodes/{collection}/{key}': fail(500)
		});
		await expect(postRecord('a', signal())).rejects.toBeInstanceOf(ApiError);
	});

	it('counts every stuk signed, past the first page, and asks for canvas props', async () => {
		let query: Record<string, unknown> | undefined;
		fakeApi({
			'/api/commitments': commitments(0),
			'/api/nodes/{collection}/{key}': ({ params }) => {
				query = params.query;
				return authored(200, 450);
			}
		});
		const record = await postRecord('a', signal());
		expect(record.signed).toBe(450);
		expect(record.authored).toHaveLength(200);
		expect(query).toMatchObject({ relations: 'AUTHORED', props: 'canvas' });
	});

	it('shows no count of the bewindspersoon before when the next one fails', async () => {
		fakeApi({
			'/api/commitments': ({ params }) =>
				params.query?.member === 'a' ? commitments(2) : fail(500),
			'/api/nodes/{collection}/{key}': authored(4)
		});
		const states: LoadState<PostRecord>[] = [];
		const post = createLoader(postRecord, (s) => states.push(s), 'post');
		post.load('a');
		await settle();
		expect(states.at(-1)).toMatchObject({ status: 'ready', data: { signed: 4 } });
		post.load('b');
		await settle();
		expect(states.at(-1)?.status).toBe('error');
	});
});
