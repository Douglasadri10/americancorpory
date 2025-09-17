export default function TableShell({ headers, children }: { headers: string[]; children?: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>{headers.map(h => <th key={h} className="text-left">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
