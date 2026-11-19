// Página 404 con el lenguaje del sitio: tarjeta de cristal, explicación y salidas (portada y documentación).
import Link from "@docusaurus/Link";
import Translate from "@docusaurus/Translate";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { useZudocs } from "../../../site";

export default function NotFoundContent() {
  const site = useZudocs();
  const firstArea = site.docs.areas[0]?.id;
  return (
    <main className="zd-container zd-notfound">
      <div className="zd-notfound__card zd-glass">
        <span className="zd-notfound__code" aria-hidden="true">
          404
        </span>
        <h1 className="zd-notfound__title">
          <Translate id="theme.NotFound.title" description="The title of the 404 page">
            Page Not Found
          </Translate>
        </h1>
        <p className="zd-notfound__text">
          <Translate id="theme.NotFound.p1" description="The first paragraph of the 404 page">
            We could not find what you were looking for.
          </Translate>
        </p>
        <div className="zd-notfound__actions">
          <Link className="z-btn z-btn--primary" to="/">
            <Icon name="arrow-left" size={16} /> Volver a la portada
          </Link>
          {firstArea ? (
            <Link className="z-btn z-btn--secondary" to={`/docs/${firstArea}`}>
              Ir a la documentación
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
