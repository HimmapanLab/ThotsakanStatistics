// The page head: "Statistics ›" small above the page's own name, over both panels. It replaces the sub-tab bar.
// Prototype: pageHead.
import type { Route } from '../app/routes'
import { pageCrumb, pageTitle } from '../content/topics'

export default function PageHead({ route }: { route: Route }) {
  const crumb = pageCrumb(route)
  return (
    <div className="pagehead">
      {crumb && (
        <nav aria-label="Breadcrumb" className="pagehead-crumb">
          <a href="#statistics-graphical">{crumb}</a> <span aria-hidden="true">›</span>
        </nav>
      )}
      {/* focus lands here after moving to another page, so a screen reader starts at the new page's name */}
      <h1 tabIndex={-1}>{pageTitle(route)}</h1>
    </div>
  )
}
