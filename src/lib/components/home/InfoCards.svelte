<script lang="ts">
  type InfoCard = {
    title: string;
    body: string;
  };

  export let heading = '';
  export let cards: InfoCard[] = [];
</script>

<section class="info-block">
  <div class="info-header">
    <h2>{heading}</h2>
  </div>
  <div class="card-grid">
    {#each cards as card, i (i)}
      <article class="info-card">
        <h3>{card.title}</h3>
        <p>{card.body}</p>
      </article>
    {/each}
  </div>
</section>

<style>
  .info-block {
    width: min(1040px, 100%);
    margin: 0 auto;
    padding: var(--space-4) 0 var(--space-3);
  }

  .info-header h2 {
    margin: 0;
    font-size: clamp(1.75rem, 2vw, 2rem);
  }

  .card-grid {
    margin-top: var(--space-3);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  .info-card {
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    padding: 1.5rem;
    background: var(--surface);
    min-height: 180px;
  }

  .info-card h3 {
    margin: 0 0 0.75rem;
    font-size: 1.25rem;
  }

  .info-card p {
    margin: 0;
    color: var(--muted);
  }
</style>
