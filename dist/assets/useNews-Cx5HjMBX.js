import{r as u}from"./react-vendor-Bsfkyusf.js";import{a as o,u as c}from"./query-vendor-CC_3ftG1.js";import{s}from"./index-CcOhh2SE.js";function h(r){const a=c();return u.useEffect(()=>{const e=s.channel("news-changes").on("postgres_changes",{event:"*",schema:"public",table:"campus_news"},()=>{a.invalidateQueries({queryKey:["news"]})}).subscribe();return()=>{s.removeChannel(e)}},[a]),o({queryKey:["news",r],queryFn:async()=>{try{let e=s.from("campus_news").select(`
            *,
            author:profiles(id, full_name, email, avatar_url)
          `).order("updated_at",{ascending:!1});r?.isPublished!==void 0?e=e.eq("is_published",r.isPublished):e=e.eq("is_published",!0),r?.category&&r.category!=="all"&&(e=e.ilike("category",r.category)),r?.search&&(e=e.or(`title.ilike.%${r.search}%,content.ilike.%${r.search}%`));const{data:t,error:n}=await e;if(n)throw console.error("Supabase query error (news):",n),n;return t||[]}catch(e){throw console.error("useNews error:",e),e}},staleTime:1e3*60*5})}function y(r=5){return o({queryKey:["news","featured",r],queryFn:async()=>{try{const{data:a,error:e}=await s.from("campus_news").select(`
            *,
            author:profiles(id, full_name, email, avatar_url)
          `).eq("is_published",!0).order("created_at",{ascending:!1}).limit(r);if(e)throw console.error("Featured news error:",e),e;return a||[]}catch(a){throw console.error("useFeaturedNews error:",a),a}},staleTime:1e3*60*10,gcTime:1e3*60*30,refetchOnWindowFocus:!1,refetchOnMount:!1,retry:0})}function m(r){return o({queryKey:["news","article",r],queryFn:async()=>{if(!r)return null;try{const{data:a,error:e}=await s.from("campus_news").select(`
            *,
            author:profiles(id, full_name, email, avatar_url)
          `).eq("id",r).single();if(e)throw console.error("News article fetch error:",e),e;try{await s.rpc("increment_news_views",{news_id:r})}catch(t){console.warn("Failed to increment views:",t)}return a}catch(a){throw console.error("useNewsArticle error:",a),a}},enabled:!!r,staleTime:1e3*60*5})}export{h as a,m as b,y as u};
//# sourceMappingURL=useNews-Cx5HjMBX.js.map
