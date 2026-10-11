// A project component, imported by an MDX doc. It renders with the style
// guide's JSX runtime, so `class` and string styles work like HTML.
export function TokenTable({ tokens }) {
  return (
    <table class="token-table">
      <thead>
        <tr>
          <th>Token</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(tokens).map(([name, value]) => (
          <tr>
            <td><code>--{name}</code></td>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
