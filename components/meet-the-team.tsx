import { getTeam } from '@/utils/data/team'
import './meet-the-team.css'

/**
 * The people to contact about a registration.
 *
 * A server component: the list comes from public/data/team.csv at request
 * time, so editing that file is the whole of "changing the team".
 *
 * The grid arranges itself to however many rows the file has - auto-fit means
 * three people centre as three, and nine wrap into rows without anybody
 * choosing a column count. Nothing renders at all when the file is missing or
 * empty, so an unfinished list leaves no hole in the page.
 */
export default function MeetTheTeam() {
  const team = getTeam()
  if (team.length === 0) return null

  return (
    <section id="team" className="team-section" aria-labelledby="team-title">
      <div className="team-section__intro scroll-reveal">
        <p className="section-label">যোগাযোগ</p>
        <h2 id="team-title">Points of contact</h2>
        <p className="team-section__lede">
          If something about your registration needs a person rather than a form
          &mdash; UPI Issues, a payment that has not been confirmed, a pass that has not
          arrived, a plate to change &mdash; please feel free to reach out to us!
        </p>
      </div>

      <ul className="team-grid scroll-reveal scroll-reveal--delay-1">
        {team.map((member) => {
          return (
            <li key={`${member.name}-${member.whatsapp}`} className="team-card">
              <div className="team-card__portrait">
                <img
                  src={member.photo}
                  alt={member.name}
                  loading="lazy"
                  decoding="async"
                  width={220}
                  height={220}
                />
              </div>

              <div className="team-card__body">
                <h3 className="team-card__name">{member.name}</h3>
                {member.role && <p className="team-card__role">{member.role}</p>}
                {member.course && <p className="team-card__course">{member.course}</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
