import type { RouteRecommendation } from "@probably-this-way/contracts";

type RecommendationBannerProps = { routeName: string; recommendation: RouteRecommendation };

export function RecommendationBanner({ routeName, recommendation }: RecommendationBannerProps) {
  return <section className="recommendation-banner" aria-live="polite" aria-label="Current route recommendation">
    <div className="recommendation-heading"><span>Recommended route</span><strong>{routeName}</strong></div>
    <div className="recommendation-score"><b>{Math.round(recommendation.suitability * 100)}</b><span>% fit</span></div>
    <p className="recommendation-explanation">{recommendation.explanation}</p>
    <dl className="recommendation-factors">{recommendation.factors.map((factor)=><div key={factor.label}><dt>{factor.label}</dt><dd>{factor.value}</dd></div>)}</dl>
    <p className="recommendation-policy">Policy {recommendation.policyVersion} · compare with official guidance and field conditions</p>
  </section>;
}
