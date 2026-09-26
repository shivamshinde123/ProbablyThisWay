import type { RouteRecommendation } from "@probably-this-way/contracts";

type RecommendationBannerProps = { routeName?: string; recommendation: RouteRecommendation };

export function RecommendationBanner({ routeName, recommendation }: RecommendationBannerProps) {
  if (recommendation.status === "unavailable") {
    return <section className="recommendation-banner recommendation-unavailable" aria-live="assertive" aria-label="No eligible route">
      <div className="recommendation-heading"><span>Route signal</span><strong>No eligible route</strong></div>
      <p className="recommendation-explanation">{recommendation.explanation}</p>
      <dl className="recommendation-factors">{recommendation.factors.map((factor)=><div key={factor.label}><dt>{factor.label}</dt><dd>{factor.value}</dd></div>)}</dl>
      <ul className="excluded-routes">{recommendation.excludedRoutes.map((route)=><li key={route.routeId}><strong>{route.routeId.replaceAll("-", " ")}</strong><span>{route.reasons.join("; ")}</span></li>)}</ul>
      <p className="recommendation-policy">Policy {recommendation.policyVersion} · official constraints override suitability</p>
    </section>;
  }

  return <section className="recommendation-banner" aria-live="polite" aria-label="Current route recommendation">
    <div className="recommendation-heading"><span>Recommended route</span><strong>{routeName}</strong></div>
    <div className="recommendation-score"><b>{Math.round(recommendation.suitability * 100)}</b><span>% fit</span></div>
    <p className="recommendation-explanation">{recommendation.explanation}</p>
    <dl className="recommendation-factors">{recommendation.factors.map((factor)=><div key={factor.label}><dt>{factor.label}</dt><dd>{factor.value}</dd></div>)}</dl>
    <p className="recommendation-policy">Policy {recommendation.policyVersion} · compare with official guidance and field conditions</p>
  </section>;
}
