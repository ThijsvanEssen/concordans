<script lang="ts">
	// A post of a cabinet opened in place, in Bewindspersonen and side by side alike: the
	// post as the API gives it, said by PostOpen.
	import { naamVan } from '$lib/bron/menselijk';
	import PostOpen from '$lib/components/open/PostOpen.svelte';
	import { postNotes, type SeatPost } from './occupancy';

	let {
		post,
		counted,
		commitmentsHref
	}: {
		post: SeatPost;
		/** False for a short stand-in beside a longer post: the API counts per person. */
		counted: boolean;
		/** Where the open toezeggingen of a person are listed. */
		commitmentsHref: (memberKey: string) => string;
	} = $props();
</script>

<PostOpen
	memberKey={post.member.key}
	naam={post.member.name ?? naamVan('members', post.member)}
	partij={post.party?.short ?? null}
	functie={(post.function ?? '') + (post.acting ? ', waarnemend' : '')}
	from={post.from_date ?? null}
	to={post.to_date ?? null}
	dossiers={post.dossiers ?? 0}
	wetsvoorstellen={post.bills ?? 0}
	geteld={counted}
	toezeggingenHref={counted && post.open_commitments ? commitmentsHref(post.member.key) : null}
	opmerkingen={postNotes(post)}
/>
