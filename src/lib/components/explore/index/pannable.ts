// Drag a scrolling strip sideways with the mouse, as a map is moved. Touch and a trackpad
// scroll it natively. A drag is not a click: the link under the pointer where the drag
// ends is not followed.

const THRESHOLD = 4;

export function pannable(node: HTMLElement) {
	let startX = 0;
	let startScroll = 0;
	let pointer: number | null = null;
	let dragged = false;

	function down(e: PointerEvent) {
		if (e.pointerType !== 'mouse' || e.button !== 0) return;
		pointer = e.pointerId;
		startX = e.clientX;
		startScroll = node.scrollLeft;
		dragged = false;
	}
	function move(e: PointerEvent) {
		if (e.pointerId !== pointer) return;
		const dx = e.clientX - startX;
		if (!dragged && Math.abs(dx) < THRESHOLD) return;
		if (!dragged) {
			dragged = true;
			// The pointer may be gone already (released outside the window).
			try {
				node.setPointerCapture(e.pointerId);
			} catch {
				/* dragging goes on without capture */
			}
			node.classList.add('is-dragging');
		}
		node.scrollLeft = startScroll - dx;
	}
	function up(e: PointerEvent) {
		if (e.pointerId !== pointer) return;
		pointer = null;
		node.classList.remove('is-dragging');
	}
	function click(e: MouseEvent) {
		if (!dragged) return;
		dragged = false;
		e.preventDefault();
		e.stopPropagation();
	}

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerup', up);
	node.addEventListener('pointercancel', up);
	node.addEventListener('click', click, true);
	return {
		destroy() {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', up);
			node.removeEventListener('click', click, true);
		}
	};
}
