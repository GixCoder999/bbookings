import './SectionHeading.css'

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="section-copy">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export default SectionHeading
