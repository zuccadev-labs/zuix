// Pie del sitio: texto de la configuración y enlaces útiles para personas y agentes.
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { useZudocs } from "../../site";

export default function Footer() {
  const site = useZudocs();
  const llms = useBaseUrl("/llms.txt");
  return (
    <footer className="zd-footer">
      <div className="zd-container zd-footer__inner">
        <p className="zd-footer__text">{site.footer ?? site.name}</p>
        <ul className="zd-footer__links">
          <li>
            <a href={llms}>llms.txt</a>
          </li>
          {site.repository ? (
            <li>
              <a href={site.repository} rel="noopener">
                Repositorio
              </a>
            </li>
          ) : null}
          <li>
            <Link to="/">Portada</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
