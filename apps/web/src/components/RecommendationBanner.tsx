import type { RouteRecommendation } from "@probably-this-way/contracts";

type RecommendationBannerProps = { routeName: string; recommendation: RouteRecommendation };

export function RecommendationBanner({ routeName, recommendation }: RecommendationBannerProps) {
  return <section className="recommendation-banner" aria-live="polite" aria-label="Current route recommendation">
    <div><span>Recommended route</span><strong>{routeName}</strong></div>
    <div className="recommendation-score"><b>{Math.round(recommendation.suitability * 100)}</b><span>% fit</span></div>
    <p>Policy {recommendation.policyVersion} · compare with official guidance and field conditions</p>
  </section>;
}
