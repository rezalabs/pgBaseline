<script lang="ts" generics="T extends string">
  let {
    id,
    value = $bindable(),
    options,
    ariaLabel,
    describedBy,
  }: {
    id?: string | undefined;
    value: T;
    options: readonly { value: T; label: string }[];
    ariaLabel?: string | undefined;
    describedBy?: string | undefined;
  } = $props();
</script>

<div class="control-wrap">
  <select {id} class="control" bind:value aria-label={ariaLabel} aria-describedby={describedBy}>
    {#each options as option (option.value)}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  <svg class="control-wrap__chevron" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.4" />
  </svg>
</div>
