import { usePublicProfile } from "../../../../shared/queries/profile";
import { usePublicContents } from "../../../../shared/queries/content";
import { usePageview } from "../../../../shared/hooks/usePageview";
import { useSeo } from "../../../../shared/hooks/useSeo";
export function useHomePage() {
  const profile = usePublicProfile();
  const projects = usePublicContents("project", {
    featured: true,
    page_size: 6,
  });
  const posts = usePublicContents("blog", { page_size: 5 });
  const life = usePublicContents("life", { page_size: 4 });
  usePageview(profile.isSuccess);
  useSeo("", profile.data?.intro);
  return { profile, projects, posts, life };
}
