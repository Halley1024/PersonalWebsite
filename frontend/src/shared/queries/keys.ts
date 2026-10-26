import {
  paths,
  type Kind,
  type PublicFilters,
  type AdminFilters,
} from "../api/content";
import type { TaxonomyType } from "../api/taxonomy";
import type { RuleFilters } from "../api/access";
import type { VisitFilters } from "../api/analytics";
export const keys = {
  session: ["session"] as const,
  profile: ["public", "profile"] as const,
  settings: ["public", "settings"] as const,
  adminProfile: ["admin", "profile"] as const,
  adminSettings: ["admin", "settings"] as const,
  publicContents: (kind: Kind, filters: PublicFilters) =>
    ["public", paths[kind], filters] as const,
  publicContent: (kind: Kind, slug: string) =>
    ["public", "content", kind, slug] as const,
  adminContents: (filters: AdminFilters) =>
    ["admin", "contents", filters] as const,
  adminContent: (id?: string) => ["admin", "content", id] as const,
  publicTaxonomy: (type: TaxonomyType, kind: Kind) =>
    ["public", "taxonomy", type, kind] as const,
  adminTaxonomy: (type: TaxonomyType, params: object) =>
    ["admin", "taxonomy", type, params] as const,
  taxonomyOptions: (type: TaxonomyType, kind: Kind) =>
    ["admin", "taxonomy", "options", type, kind] as const,
  media: (params: object) => ["admin", "media", params] as const,
  rules: (filters: RuleFilters) => ["admin", "access", filters] as const,
  regions: ["admin", "regions"] as const,
  analytics: (days: number) => ["admin", "analytics", days] as const,
  visits: (filters: VisitFilters) => ["admin", "visits", filters] as const,
  dashboard: ["admin", "dashboard"] as const,
};
