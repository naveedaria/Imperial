export function StatusPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={`status status-${value}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
