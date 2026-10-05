import { getTeam, whatsappLink } from '@/utils/data/team'
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
          &mdash; a payment that has not been confirmed, a pass that has not
          arrived, a plate to change &mdash; message any of us on WhatsApp.
        </p>
      </div>

      <ul className="team-grid scroll-reveal scroll-reveal--delay-1">
        {team.map((member) => {
          const link = whatsappLink(member.whatsapp)
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

                {link ? (
                  <a
                    className="team-card__wa"
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Message ${member.name} on WhatsApp`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" fill="currentColor">
                      <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-1.6-.8-2.7-1.5-3.8-3.4-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.4 1.9.8 2.6.9 3.5.8.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/>
                      <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.4A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1 1 12 20.2z"/>
                    </svg>
                    {member.whatsapp}
                  </a>
                ) : (
                  <span className="team-card__wa is-muted">{member.whatsapp}</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
