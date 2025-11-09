export default function StatsCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="card stats-card">
      <p className="muted" style={{ fontSize: 13 }}>
        {title}
      </p>
      <p style={{ marginTop: 6, fontSize: 24, fontWeight: 700 }}>{value}</p>
    </div>
  );
}
