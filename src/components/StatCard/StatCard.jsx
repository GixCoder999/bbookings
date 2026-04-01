import './StatCard.css'

function StatCard({ label, value, hint }) {
  return (
    <article className="stat-card">
      <p className="stat-card__label">{label}</p>
      <strong>{value}</strong>
      {hint && <span>{hint}</span>}
    </article>
  )
}

export default StatCard
