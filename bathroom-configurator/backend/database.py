import os
from typing import Optional, Dict, Any, List
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

class SupabaseDB:
    def __init__(self):
        supabase_url = os.getenv("VITE_SUPABASE_URL")
        supabase_key = os.getenv("VITE_SUPABASE_SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError("Supabase credentials not found in environment variables")

        self.client: Client = create_client(supabase_url, supabase_key)

    async def store_bathroom_spec(
        self,
        session_id: str,
        spec_json: Dict[str, Any],
        image_url: Optional[str] = None,
        confidence_score: Optional[float] = None
    ) -> Dict[str, Any]:
        try:
            dimensions = spec_json.get("dimensions", {})
            fixtures = spec_json.get("fixtures", [])
            style_prefs = spec_json.get("style_preferences", {})

            data = {
                "session_id": session_id,
                "spec_json": spec_json,
                "image_url": image_url,
                "confidence_score": confidence_score,
                "dimensions": dimensions,
                "fixtures": fixtures,
                "style_preferences": style_prefs
            }

            result = self.client.table("bathroom_specs").insert(data).execute()
            return result.data[0] if result.data else {}
        except Exception as e:
            print(f"Error storing bathroom spec: {e}")
            return {}

    async def store_render(
        self,
        session_id: str,
        spec_id: Optional[str],
        selected_style: str,
        render_url: str,
        prompt_used: str,
        generation_time_ms: int
    ) -> Dict[str, Any]:
        try:
            data = {
                "session_id": session_id,
                "spec_id": spec_id,
                "selected_style": selected_style,
                "render_url": render_url,
                "prompt_used": prompt_used,
                "generation_time_ms": generation_time_ms
            }

            result = self.client.table("renders").insert(data).execute()
            return result.data[0] if result.data else {}
        except Exception as e:
            print(f"Error storing render: {e}")
            return {}

    async def store_lead(
        self,
        name: str,
        email: str,
        phone: Optional[str],
        session_id: Optional[str],
        spec_json: Optional[Dict[str, Any]],
        render_url: Optional[str],
        lead_score: Optional[str],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        try:
            data = {
                "name": name,
                "email": email,
                "phone": phone,
                "session_id": session_id,
                "spec_json": spec_json,
                "render_url": render_url,
                "lead_score": lead_score,
                "status": "new",
                "metadata": metadata or {}
            }

            result = self.client.table("leads").insert(data).execute()
            return result.data[0] if result.data else {}
        except Exception as e:
            print(f"Error storing lead: {e}")
            return {}

    async def track_event(
        self,
        session_id: str,
        event_type: str,
        event_data: Optional[Dict[str, Any]] = None,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> bool:
        try:
            data = {
                "session_id": session_id,
                "event_type": event_type,
                "event_data": event_data or {},
                "user_agent": user_agent,
                "ip_address": ip_address
            }

            self.client.table("analytics_events").insert(data).execute()
            return True
        except Exception as e:
            print(f"Error tracking event: {e}")
            return False

    async def get_all_leads(
        self,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        try:
            query = self.client.table("leads").select("*").order("created_at", desc=True)

            if status:
                query = query.eq("status", status)

            result = query.limit(limit).offset(offset).execute()
            return result.data if result.data else []
        except Exception as e:
            print(f"Error fetching leads: {e}")
            return []

    async def update_lead_status(self, lead_id: str, status: str) -> bool:
        try:
            self.client.table("leads").update({"status": status}).eq("id", lead_id).execute()
            return True
        except Exception as e:
            print(f"Error updating lead status: {e}")
            return False

    async def get_analytics_summary(self, days: int = 7) -> Dict[str, Any]:
        try:
            total_leads_result = self.client.table("leads").select("id", count="exact").execute()
            total_leads = total_leads_result.count if hasattr(total_leads_result, 'count') else 0

            total_specs_result = self.client.table("bathroom_specs").select("id", count="exact").execute()
            total_specs = total_specs_result.count if hasattr(total_specs_result, 'count') else 0

            total_renders_result = self.client.table("renders").select("id", count="exact").execute()
            total_renders = total_renders_result.count if hasattr(total_renders_result, 'count') else 0

            conversion_rate = (total_leads / total_specs * 100) if total_specs > 0 else 0

            popular_styles_result = self.client.table("renders").select("selected_style").execute()
            style_counts = {}
            if popular_styles_result.data:
                for render in popular_styles_result.data:
                    style = render.get("selected_style", "Unknown")
                    style_counts[style] = style_counts.get(style, 0) + 1

            popular_styles = sorted(style_counts.items(), key=lambda x: x[1], reverse=True)[:5]

            return {
                "total_leads": total_leads,
                "total_specs": total_specs,
                "total_renders": total_renders,
                "conversion_rate": round(conversion_rate, 2),
                "popular_styles": [{"style": style, "count": count} for style, count in popular_styles]
            }
        except Exception as e:
            print(f"Error fetching analytics summary: {e}")
            return {
                "total_leads": 0,
                "total_specs": 0,
                "total_renders": 0,
                "conversion_rate": 0,
                "popular_styles": []
            }

db = SupabaseDB()
