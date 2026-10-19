// After a choice for a bundel from a file (Gemarkeerd), the focus goes to the head of the bundel
// it made or changed, not to the page: the section of the file is gone (F2).

/**
 * The bundel a choice made or changed: the new one (by then the active one), the one added to
 * (else the active one), the one replaced; null where nothing changed.
 */
export function mapAfterFile(
	how: 'map' | 'add' | 'replace' | 'none',
	target: { id: string } | undefined,
	active: { id: string }
): string | null {
	if (how === 'map') return active.id;
	if (how === 'add') return (target ?? active).id;
	if (how === 'replace') return target?.id ?? null;
	return null;
}
